import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const noteId = String(body.noteId ?? "");
  const direction = String(body.direction ?? "");
  const targetId = body.targetId ? String(body.targetId) : "";

  const supabase = await createClient();

  // Dragged onto another note: take its place.
  if (noteId && targetId) {
    const { error } = await supabase.rpc("move_note_to", { p_note_id: noteId, p_target_id: targetId });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  if (!noteId || (direction !== "up" && direction !== "down")) {
    return Response.json({ error: "noteId and a direction of 'up' or 'down' are required." }, { status: 400 });
  }

  const { error } = await supabase.rpc("move_note", { p_note_id: noteId, p_direction: direction });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
