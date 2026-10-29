import { createClient } from "@/lib/supabase/server";
import { loadIdeaHouse } from "@/lib/idea-house";

// Idea House: the public ledger, the next review date, and decisions on
// the applications you can see. ?dictionaryId
export async function GET(request: Request) {
  const dictionaryId = new URL(request.url).searchParams.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  try {
    return Response.json(await loadIdeaHouse(supabase, dictionaryId));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
