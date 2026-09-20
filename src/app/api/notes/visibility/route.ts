import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const noteId = String(body.noteId ?? "");
  const visibility = String(body.visibility ?? "");

  if (!noteId || (visibility !== "public" && visibility !== "private")) {
    return Response.json({ error: "noteId and a visibility of 'public' or 'private' are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
