import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const noteId = body.noteId ? String(body.noteId) : null;
  const archiveId = body.archiveId ? String(body.archiveId) : null;

  if (!noteId && !archiveId) {
    return Response.json({ error: "Provide either noteId or archiveId." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = noteId
    ? await supabase.rpc("restore_note", { p_note_id: noteId })
    : await supabase.rpc("restore_archive", { p_archive_id: archiveId });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
