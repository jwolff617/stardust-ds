import { createClient } from "@/lib/supabase/server";
import { isWeekStart } from "@/lib/after-school";
import { regenerateWeeks } from "@/lib/after-school-db";

// Copies the lesson template over every day of the given weeks.
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const weeks = (Array.isArray(body.weeks) ? body.weeks : []).filter(isWeekStart);
  if (!dictionaryId || weeks.length === 0) {
    return Response.json({ error: "dictionaryId and weeks are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  try {
    await regenerateWeeks(supabase, dictionaryId, user.id, weeks);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
