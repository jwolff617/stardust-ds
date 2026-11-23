import { createClient } from "@/lib/supabase/server";
import { searchEverything } from "@/lib/search";

// The search form when signed out: public words only, no Sage. Signed in,
// the same search runs through Sage AI.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const get = (k: string) => searchParams.get(k) ?? "";
  const supabase = await createClient();
  try {
    const items = await searchEverything(supabase, {
      word: get("word"),
      body: get("body"),
      place: get("place"),
      people: get("people"),
      time: get("time"),
      visibility: get("visibility"),
    });
    return Response.json({ items });
  } catch (err) {
    return Response.json({ items: [], error: (err as Error).message }, { status: 200 });
  }
}
