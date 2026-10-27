import { createClient } from "@/lib/supabase/server";
import { isWeekStart } from "@/lib/after-school";
import { ensureLessonWeeks, updateLesson } from "@/lib/after-school-db";

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

  try {
    const rows = await ensureLessonWeeks(supabase, dictionaryId, user.id, weeks);
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

  try {
    await updateLesson(supabase, user.id, id, body.body);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
