import { createClient } from "@/lib/supabase/server";
import { expiresAtFor, isTimeFrame, normalizeNoteLabel, safeTimeZone } from "@/lib/time-frames";

const PAGE_SIZE = 25;
const STATES = ["active", "archived", "done"] as const;
type NoteState = (typeof STATES)[number];

// Night DS Display View. `state` picks the list: active notes (in the
// owner's order), Archived, or Done (newest first). `timeFrame` and
// `label` filter it; leaving either out shows everything.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const dictionaryIds = (searchParams.get("dictionaryIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const requestedState = searchParams.get("state") as NoteState;
  const state: NoteState = STATES.includes(requestedState) ? requestedState : "active";
  const timeFrame = searchParams.get("timeFrame");
  const label = normalizeNoteLabel(searchParams.get("label"));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  if (dictionaryIds.length === 0) {
    return Response.json({ items: [], labels: [], page, totalPages: 1 });
  }

  const supabase = await createClient();

  // Notes whose time is up archive themselves before anything is read.
  await supabase.rpc("sweep_expired_notes");

  const { data: dictionaries } = await supabase
    .from("dictionaries")
    .select("id, name")
    .in("id", dictionaryIds);
  const nameFor = new Map((dictionaries ?? []).map((d) => [d.id, d.name]));

  let query = supabase
    .from("notes")
    .select(
      "id, body, dictionary_id, visibility, time_frame, label, expires_at, archived_at, done_at, created_at",
      { count: "exact" },
    )
    .in("dictionary_id", dictionaryIds);

  if (state === "active") query = query.is("archived_at", null).is("done_at", null);
  else if (state === "archived") query = query.not("archived_at", "is", null).is("done_at", null);
  else query = query.not("done_at", "is", null);

  if (isTimeFrame(timeFrame)) query = query.eq("time_frame", timeFrame);
  if (label) query = query.eq("label", label);

  if (state === "active") query = query.order("position", { ascending: true });
  else query = query.order(state === "done" ? "done_at" : "archived_at", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Every label in use, so custom labels show up as filters too.
  const { data: labelRows } = await supabase
    .from("notes")
    .select("label")
    .in("dictionary_id", dictionaryIds)
    .not("label", "is", null);
  const labels = [...new Set((labelRows ?? []).map((r) => r.label as string))].sort();

  const items = (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    dictionaryId: row.dictionary_id,
    dictionaryName: nameFor.get(row.dictionary_id) ?? "",
    visibility: row.visibility,
    timeFrame: row.time_frame,
    label: row.label,
    expiresAt: row.expires_at,
    archivedAt: row.archived_at,
    doneAt: row.done_at,
    createdAt: row.created_at,
  }));

  const total = count ?? 0;
  return Response.json({
    items,
    labels,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const content = String(body.body ?? "").trim();
  const timeFrame = isTimeFrame(body.timeFrame) ? body.timeFrame : "life";
  const label = normalizeNoteLabel(body.label);

  if (!dictionaryId || !content) {
    return Response.json({ error: "dictionaryId and body are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const expiresAt = expiresAtFor(timeFrame, new Date(), safeTimeZone(body.timeZone));
  const { error } = await supabase.from("notes").insert({
    dictionary_id: dictionaryId,
    owner_user_id: user.id,
    body: content,
    time_frame: timeFrame,
    label,
    expires_at: expiresAt?.toISOString() ?? null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
