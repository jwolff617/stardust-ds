import { createClient } from "@/lib/supabase/server";

const PAGE_SIZES = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 200];

function resolvePageSize(requested: number): number {
  if (PAGE_SIZES.includes(requested)) return requested;
  return PAGE_SIZES.reduce((closest, size) =>
    Math.abs(size - requested) < Math.abs(closest - requested) ? size : closest,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const dictionaryIds = (searchParams.get("dictionaryIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const archiveId = searchParams.get("archiveId");
  const pageSize = resolvePageSize(Number(searchParams.get("pageSize") ?? "5") || 5);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const supabase = await createClient();

  if (dictionaryIds.length === 0) {
    return Response.json({ items: [], page, pageSize, total: 0, totalPages: 1 });
  }

  const { data: dictionaries } = await supabase
    .from("dictionaries")
    .select("id, name")
    .in("id", dictionaryIds);

  const nameFor = new Map((dictionaries ?? []).map((d) => [d.id, d.name]));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notes")
    .select("id, body, dictionary_id, visibility", { count: "exact" })
    .in("dictionary_id", dictionaryIds);

  query = archiveId ? query.eq("archive_id", archiveId) : query.is("archive_id", null);

  const { data, count, error } = await query
    .order("position", { ascending: true })
    .range(from, to);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    dictionaryId: row.dictionary_id,
    dictionaryName: nameFor.get(row.dictionary_id) ?? "",
    visibility: row.visibility,
  }));

  const total = count ?? 0;

  return Response.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const content = String(body.body ?? "").trim();

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

  const { error } = await supabase
    .from("notes")
    .insert({ dictionary_id: dictionaryId, owner_user_id: user.id, body: content });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
