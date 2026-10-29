import { createClient } from "@/lib/supabase/server";
import { expiresAtFor, isNoteSort, isTimeFrame, normalizeNoteLabel, safeTimeZone, TIME_FRAMES } from "@/lib/time-frames";

const PAGE_SIZE = 25;
const STATES = ["active", "archived", "done"] as const;
type NoteState = (typeof STATES)[number];

// Night DS Display View. `state` picks the list: active notes, Archived,
// or Done. `timeFrames` and `labels` (comma-separated, any of them match)
// filter it; leaving either out shows everything. `sort`: shortest time
// frame first (the default), longest first, newest, oldest, or "mine"
// (the drag order).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const dictionaryIds = (searchParams.get("dictionaryIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const requestedState = searchParams.get("state") as NoteState;
  const state: NoteState = STATES.includes(requestedState) ? requestedState : "active";
  const list = (key: string) => (searchParams.get(key) ?? "").split(",").filter(Boolean);
  const timeFrames = list("timeFrames").filter(isTimeFrame);
  const labels = list("labels").map(normalizeNoteLabel).filter((l) => l !== null);
  const requestedSort = searchParams.get("sort");
  const sort = isNoteSort(requestedSort) ? requestedSort : "shortest";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  if (dictionaryIds.length === 0) {
    return Response.json({ items: [], page, totalPages: 1 });
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

  if (timeFrames.length > 0) query = query.in("time_frame", timeFrames);
  if (labels.length > 0) query = query.in("label", labels);

  // Recency means when it was written, or for Archived and Done, when it
  // left. Time-frame sorts break ties by the drag order.
  const when = state === "active" ? "created_at" : state === "done" ? "done_at" : "archived_at";
  if (sort === "newest" || sort === "oldest") query = query.order(when, { ascending: sort === "oldest" });
  else query = query.order("position", { ascending: true }).order("created_at", { ascending: false });

  // Time frames aren't alphabetical, so those sorts happen here, over every
  // matching note (a person's notes number in the hundreds, not millions).
  const byTimeFrame = sort === "shortest" || sort === "longest";
  const from = (page - 1) * PAGE_SIZE;
  const result = byTimeFrame ? await query.limit(5000) : await query.range(from, from + PAGE_SIZE - 1);
  const { count, error } = result;
  let data = result.data;
  if (byTimeFrame && data) {
    const rank = (tf: string) => TIME_FRAMES.indexOf(tf as (typeof TIME_FRAMES)[number]);
    const dir = sort === "shortest" ? 1 : -1;
    // Array sort is stable, so the database order breaks ties.
    data = [...data].sort((a, b) => dir * (rank(a.time_frame) - rank(b.time_frame))).slice(from, from + PAGE_SIZE);
  }

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }


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
