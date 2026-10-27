import { createClient } from "@/lib/supabase/server";
import { isWeekStart } from "@/lib/after-school";

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

  const { data: template, error: templateError } = await supabase
    .from("after_school_lessons")
    .select("weekday, body")
    .eq("dictionary_id", dictionaryId)
    .is("week_start", null);
  if (templateError) return Response.json({ error: templateError.message }, { status: 500 });

  const now = new Date().toISOString();
  for (const weekday of [1, 2, 3, 4, 5]) {
    const text = template?.find((t) => t.weekday === weekday)?.body ?? "";
    const { error } = await supabase
      .from("after_school_lessons")
      .update({ body: text, updated_by: user.id, updated_at: now })
      .eq("dictionary_id", dictionaryId)
      .eq("weekday", weekday)
      .in("week_start", weeks);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
