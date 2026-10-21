import { createClient } from "@/lib/supabase/server";

// Marks a note Done. Done is its own archive and keeps the note's time
// frame, so you can look back at what you did.
export async function POST(request: Request) {
  const body = await request.json();
  const noteId = String(body.noteId ?? "");

  if (!noteId) {
    return Response.json({ error: "noteId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notes")
    .update({ done_at: now, updated_at: now })
    .eq("id", noteId)
    .is("done_at", null);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
