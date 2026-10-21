import { createClient } from "@/lib/supabase/server";

// Archives one note (noteId), or sweeps several active notes into one
// dated "Archive all" snapshot (dictionaryId + noteIds).
export async function POST(request: Request) {
  const body = await request.json();
  const noteId = body.noteId ? String(body.noteId) : null;
  const dictionaryId = String(body.dictionaryId ?? "");
  const noteIds = Array.isArray(body.noteIds) ? body.noteIds.map(String) : [];
  const label = body.label ? String(body.label).trim() : null;

  const supabase = await createClient();

  if (noteId) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notes")
      .update({ archived_at: now, updated_at: now })
      .eq("id", noteId)
      .is("archived_at", null)
      .is("done_at", null);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  if (!dictionaryId || noteIds.length === 0) {
    return Response.json({ error: "Provide a noteId, or a dictionaryId and noteIds." }, { status: 400 });
  }

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
