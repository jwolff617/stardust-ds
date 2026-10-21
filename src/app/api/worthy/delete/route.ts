import { createClient } from "@/lib/supabase/server";

// Deletes a money entry ({ entryId }) or a bet story ({ storyId }).
export async function POST(request: Request) {
  const body = await request.json();
  const entryId = body.entryId ? String(body.entryId) : null;
  const storyId = body.storyId ? String(body.storyId) : null;

  if (!entryId && !storyId) {
    return Response.json({ error: "Provide an entryId or a storyId." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = entryId
    ? await supabase.from("worthy_entries").delete().eq("id", entryId)
    : await supabase.from("bet_stories").delete().eq("id", storyId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
