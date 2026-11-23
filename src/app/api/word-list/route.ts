import { createClient } from "@/lib/supabase/server";

// Today's Word List: whether there is one, and its words in order.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ exists: false, words: [] });
  const [{ data: list, error }, { data: words }] = await Promise.all([
    supabase.from("word_lists").select("created_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("word_list_words").select("id, word, kind, ref_id").eq("user_id", user.id).order("position").order("created_at"),
  ]);
  if (error) return Response.json({ exists: false, words: [], error: "The word list needs migration 0049." });
  return Response.json({
    exists: Boolean(list),
    words: (words ?? []).map((w) => ({ id: w.id, word: w.word, kind: w.kind, refId: w.ref_id })),
  });
}
