import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const noteIds = Array.isArray(body.noteIds) ? body.noteIds.map(String) : [];
  const label = body.label ? String(body.label).trim() : null;

  if (!dictionaryId || noteIds.length === 0) {
    return Response.json({ error: "dictionaryId and at least one noteId are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_notes", {
    p_dictionary_id: dictionaryId,
    p_note_ids: noteIds,
    p_label: label,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, archiveId: data });
}
