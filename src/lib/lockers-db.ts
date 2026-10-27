import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ATTENDANCE_KINDS,
  ATTENDANCE_STATUSES,
  LOCKER_COUNT,
  isIsoDate,
  type Attendance,
  type Bar,
  type Locker,
  type Participant,
  type Post,
  type PostKind,
} from "./lockers";

// Lockers reads and writes. RLS does the guarding: anyone reads the public
// page, only admin group members write it, and only members touch the
// admin group's records.

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function dateOrNull(value: unknown): string | null {
  return isIsoDate(value) ? value : null;
}

// ---- The public page ----

export async function loadPosts(supabase: SupabaseClient): Promise<{ posts: Post[]; canEdit: boolean }> {
  const [{ data, error }, { data: canEdit }] = await Promise.all([
    supabase.from("lockers_posts").select("id, kind, body, created_at").order("created_at", { ascending: false }),
    supabase.rpc("is_lockers_admin"),
  ]);
  check(error);
  return {
    posts: (data ?? []).map((r) => ({ id: r.id, kind: r.kind as PostKind, body: r.body, createdAt: r.created_at })),
    canEdit: Boolean(canEdit),
  };
}

// Hours and rules are one block each, so saving one replaces it. An
// announcement with no id is a new one.
export async function savePost(
  supabase: SupabaseClient,
  userId: string,
  post: { id?: string; kind: PostKind; body: string },
): Promise<void> {
  const row = { kind: post.kind, body: text(post.body, 10000), updated_by: userId, updated_at: new Date().toISOString() };
  if (post.id) {
    check((await supabase.from("lockers_posts").update(row).eq("id", post.id)).error);
  } else if (post.kind === "announcement") {
    check((await supabase.from("lockers_posts").insert(row)).error);
  } else {
    const { data } = await supabase.from("lockers_posts").select("id").eq("kind", post.kind).maybeSingle();
    const result = data
      ? await supabase.from("lockers_posts").update(row).eq("id", data.id)
      : await supabase.from("lockers_posts").insert(row);
    check(result.error);
  }
}

export async function deletePost(supabase: SupabaseClient, id: string): Promise<void> {
  check((await supabase.from("lockers_posts").delete().eq("id", id)).error);
}

// ---- The admin group ----

export type AdminData = {
  participants: Participant[];
  lockers: Locker[];
  bars: Bar[];
  attendance: Attendance[];
};

// Everything the admin view needs, with attendance from `since` on.
export async function loadAdmin(supabase: SupabaseClient, dictionaryId: string, since: string): Promise<AdminData> {
  const [participants, lockers, bars, attendance] = await Promise.all([
    supabase
      .from("lockers_participants")
      .select("id, name, member_since, renewed_thru, shifts_required, notes, archived")
      .eq("dictionary_id", dictionaryId)
      .order("name"),
    supabase
      .from("lockers_lockers")
      .select("number, participant_id, assigned_date, broken, notes")
      .eq("dictionary_id", dictionaryId)
      .order("number"),
    supabase
      .from("lockers_bars")
      .select("id, participant_id, status, type, reason, start_date, end_date")
      .eq("dictionary_id", dictionaryId)
      .order("start_date", { ascending: false }),
    supabase
      .from("lockers_attendance")
      .select("participant_id, date, kind, status")
      .eq("dictionary_id", dictionaryId)
      .gte("date", since),
  ]);
  for (const result of [participants, lockers, bars, attendance]) check(result.error);

  return {
    participants: (participants.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      memberSince: r.member_since,
      renewedThru: r.renewed_thru,
      shiftsRequired: r.shifts_required,
      notes: r.notes,
      archived: r.archived,
    })),
    lockers: (lockers.data ?? []).map((r) => ({
      number: r.number,
      participantId: r.participant_id,
      assignedDate: r.assigned_date,
      broken: r.broken,
      notes: r.notes,
    })),
    bars: (bars.data ?? []).map((r) => ({
      id: r.id,
      participantId: r.participant_id,
      status: r.status,
      type: r.type,
      reason: r.reason,
      startDate: r.start_date,
      endDate: r.end_date,
    })),
    attendance: (attendance.data ?? []).map((r) => ({
      participantId: r.participant_id,
      date: r.date,
      kind: r.kind,
      status: r.status,
    })),
  };
}

export async function saveParticipant(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  p: Record<string, unknown>,
): Promise<void> {
  const name = text(p.name, 200).trim();
  if (!name) throw new Error("A participant needs a name.");
  const shifts = Number(p.shiftsRequired ?? 1);
  const row = {
    dictionary_id: dictionaryId,
    name,
    member_since: dateOrNull(p.memberSince),
    renewed_thru: dateOrNull(p.renewedThru),
    shifts_required: Number.isInteger(shifts) && shifts >= 0 && shifts <= 7 ? shifts : 1,
    notes: text(p.notes, 5000),
    archived: Boolean(p.archived),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const result = p.id
    ? await supabase.from("lockers_participants").update(row).eq("id", String(p.id)).eq("dictionary_id", dictionaryId)
    : await supabase.from("lockers_participants").insert(row);
  check(result.error);

  // Archiving someone frees their lockers.
  if (p.id && row.archived) {
    check(
      (
        await supabase
          .from("lockers_lockers")
          .update({ participant_id: null, assigned_date: null, updated_by: userId, updated_at: row.updated_at })
          .eq("dictionary_id", dictionaryId)
          .eq("participant_id", String(p.id))
      ).error,
    );
  }
}

export async function saveLocker(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  l: Record<string, unknown>,
): Promise<void> {
  const number = Number(l.number);
  if (!Number.isInteger(number) || number < 1 || number > LOCKER_COUNT) throw new Error("No locker has that number.");
  const participantId = l.participantId ? String(l.participantId) : null;
  check(
    (
      await supabase.from("lockers_lockers").upsert(
        {
          dictionary_id: dictionaryId,
          number,
          participant_id: participantId,
          assigned_date: participantId ? dateOrNull(l.assignedDate) ?? new Date().toISOString().slice(0, 10) : null,
          broken: Boolean(l.broken),
          notes: text(l.notes, 2000),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "dictionary_id,number" },
      )
    ).error,
  );
}

export async function saveBar(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  b: Record<string, unknown>,
): Promise<void> {
  const status = ["recommended", "issued", "dismissed"].includes(String(b.status)) ? String(b.status) : "recommended";
  const type = b.type === "permanent" ? "permanent" : "temporary";
  const endDate = type === "permanent" ? null : dateOrNull(b.endDate);
  if (status === "issued" && type === "temporary" && !endDate) throw new Error("A temporary bar needs an end date.");
  const row = {
    dictionary_id: dictionaryId,
    participant_id: String(b.participantId ?? ""),
    status,
    type,
    reason: text(b.reason, 2000),
    start_date: dateOrNull(b.startDate) ?? new Date().toISOString().slice(0, 10),
    end_date: endDate,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (!row.participant_id) throw new Error("Pick a participant.");
  const result = b.id
    ? await supabase.from("lockers_bars").update(row).eq("id", String(b.id)).eq("dictionary_id", dictionaryId)
    : await supabase.from("lockers_bars").insert(row);
  check(result.error);
}

// Sets one mark. A null status clears it.
export async function setAttendance(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  a: Record<string, unknown>,
): Promise<void> {
  const participantId = String(a.participantId ?? "");
  const kind = String(a.kind);
  if (!participantId || !isIsoDate(a.date) || !ATTENDANCE_KINDS.some((k) => k.key === kind)) {
    throw new Error("Attendance needs a participant, a date, and a kind.");
  }
  if (a.status === null) {
    check(
      (
        await supabase
          .from("lockers_attendance")
          .delete()
          .eq("dictionary_id", dictionaryId)
          .eq("participant_id", participantId)
          .eq("date", a.date)
          .eq("kind", kind)
      ).error,
    );
    return;
  }
  if (!ATTENDANCE_STATUSES.includes(a.status as never)) throw new Error("Unknown attendance status.");
  check(
    (
      await supabase.from("lockers_attendance").upsert(
        {
          dictionary_id: dictionaryId,
          participant_id: participantId,
          date: a.date,
          kind,
          status: a.status,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participant_id,date,kind" },
      )
    ).error,
  );
}
