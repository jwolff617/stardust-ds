import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");

  if (!dictionaryId) {
    return Response.json({ error: "dictionaryId is required." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: archives, error } = await supabase
    .from("note_archives")
    .select("id, label, created_at")
    .eq("dictionary_id", dictionaryId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const archiveIds = (archives ?? []).map((a) => a.id);
  const { data: counts } = archiveIds.length
    ? await supabase.from("notes").select("archive_id").in("archive_id", archiveIds)
    : { data: [] as { archive_id: string | null }[] };

  const countFor = new Map<string, number>();
  for (const row of counts ?? []) {
    if (!row.archive_id) continue;
    countFor.set(row.archive_id, (countFor.get(row.archive_id) ?? 0) + 1);
  }

  const items = (archives ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    createdAt: a.created_at,
    noteCount: countFor.get(a.id) ?? 0,
  }));

  return Response.json({ items });
}
