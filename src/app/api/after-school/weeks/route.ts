import { createClient } from "@/lib/supabase/server";
import { isWeekStart, normalizeActivities } from "@/lib/after-school";

// The theme calendar for the requested weeks. Weeks never typed in come
// back empty. RLS keeps it to group members.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  const weeks = (searchParams.get("weeks") ?? "").split(",").filter(isWeekStart);
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });
  if (weeks.length === 0) return Response.json({ items: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("after_school_weeks")
    .select("week_start, theme, activities")
    .eq("dictionary_id", dictionaryId)
    .in("week_start", weeks);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    items: (data ?? []).map((row) => ({
      weekStart: row.week_start,
      theme: row.theme,
      activities: normalizeActivities(row.activities),
    })),
  });
}

// Saves one week: its theme and five activities.
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  if (!dictionaryId || !isWeekStart(body.weekStart)) {
    return Response.json({ error: "dictionaryId and a Monday weekStart are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const { error } = await supabase.from("after_school_weeks").upsert(
    {
      dictionary_id: dictionaryId,
      week_start: body.weekStart,
      theme: typeof body.theme === "string" ? body.theme.slice(0, 200) : "",
      activities: normalizeActivities(body.activities),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dictionary_id,week_start" },
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
