import { createClient } from "@/lib/supabase/server";
import { isWeekStart } from "@/lib/after-school";

type LessonRow = { id: string; week_start: string | null; weekday: number; body: string };

// The lesson template plus the requested weeks. A week with no lessons yet
// starts as a copy of the template. RLS keeps it to group members.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  const weeks = (searchParams.get("weeks") ?? "").split(",").filter(isWeekStart);
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const load = async () => {
    const filter = weeks.length > 0 ? `week_start.is.null,week_start.in.(${weeks.join(",")})` : "week_start.is.null";
    const { data, error } = await supabase
      .from("after_school_lessons")
      .select("id, week_start, weekday, body")
      .eq("dictionary_id", dictionaryId)
      .or(filter);
    if (error) throw new Error(error.message);
    return (data ?? []) as LessonRow[];
  };

  try {
    let rows = await load();
    const template = rows.filter((r) => r.week_start === null);
    const templateBody = (weekday: number) => template.find((r) => r.weekday === weekday)?.body ?? "";

    const missing: { dictionary_id: string; week_start: string | null; weekday: number; body: string; updated_by: string }[] = [];
    for (const weekday of [1, 2, 3, 4, 5]) {
      if (!template.some((r) => r.weekday === weekday)) {
        missing.push({ dictionary_id: dictionaryId, week_start: null, weekday, body: "", updated_by: user.id });
      }
    }
    for (const week of weeks) {
      if (rows.some((r) => r.week_start === week)) continue;
      for (const weekday of [1, 2, 3, 4, 5]) {
        missing.push({ dictionary_id: dictionaryId, week_start: week, weekday, body: templateBody(weekday), updated_by: user.id });
      }
    }

    if (missing.length > 0) {
      // Two members opening the same new week at once both try to copy it;
      // the unique index keeps one, and the reload picks it up.
      await supabase.from("after_school_lessons").insert(missing);
      rows = await load();
    }

    return Response.json({
      items: rows.map((r) => ({ id: r.id, weekStart: r.week_start, weekday: r.weekday, body: r.body })),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Saves one day's lesson.
export async function POST(request: Request) {
  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id || typeof body.body !== "string") {
    return Response.json({ error: "id and body are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const { error } = await supabase
    .from("after_school_lessons")
    .update({ body: body.body.slice(0, 5000), updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
