import { createClient } from "@/lib/supabase/server";
import { isWeekStart, normalizeActivities } from "@/lib/after-school";
import { loadWeeks, saveWeek } from "@/lib/after-school-db";

// The theme calendar for the requested weeks. Weeks never typed in come
// back empty. RLS keeps it to group members.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  const weeks = (searchParams.get("weeks") ?? "").split(",").filter(isWeekStart);
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  try {
    const rows = await loadWeeks(supabase, dictionaryId, weeks);
    return Response.json({
      items: rows.map((row) => ({
        weekStart: row.week_start,
        theme: row.theme,
        activities: normalizeActivities(row.activities),
      })),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
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

  try {
    await saveWeek(supabase, dictionaryId, user.id, {
      week_start: body.weekStart,
      theme: typeof body.theme === "string" ? body.theme : "",
      activities: normalizeActivities(body.activities),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
