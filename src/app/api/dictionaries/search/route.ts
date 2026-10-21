import { createClient } from "@/lib/supabase/server";
import { searchDictionaries } from "@/lib/dictionary-search";

// Matches dictionary names, addresses, descriptions, and labels.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const dictionaries = await searchDictionaries(supabase, q, user?.id ?? null);
    return Response.json({ dictionaries });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
