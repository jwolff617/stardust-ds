import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const entryId = String(body.entryId ?? "");

  if (!entryId) {
    return Response.json({ error: "entryId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("account_entries").delete().eq("id", entryId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
