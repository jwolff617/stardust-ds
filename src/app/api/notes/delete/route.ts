import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const noteId = String(body.noteId ?? "");

  if (!noteId) {
    return Response.json({ error: "noteId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
