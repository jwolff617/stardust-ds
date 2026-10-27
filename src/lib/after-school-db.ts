import type { SupabaseClient } from "@supabase/supabase-js";

// After School DS reads and writes shared by the Display View's API routes
// and Sage AI, so both follow the same rules. RLS limits every call to
// group members.

export type LessonRow = { id: string; week_start: string | null; weekday: number; body: string };

const WEEKDAYS = [1, 2, 3, 4, 5];

async function loadLessons(supabase: SupabaseClient, dictionaryId: string, weeks: string[]) {
  const filter = weeks.length > 0 ? `week_start.is.null,week_start.in.(${weeks.join(",")})` : "week_start.is.null";
  const { data, error } = await supabase
    .from("after_school_lessons")
    .select("id, week_start, weekday, body")
    .eq("dictionary_id", dictionaryId)
    .or(filter);
  if (error) throw new Error(error.message);
  return (data ?? []) as LessonRow[];
}

// The template plus the given weeks. A week with no lessons yet starts as
// a copy of the template.
export async function ensureLessonWeeks(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  weeks: string[],
): Promise<LessonRow[]> {
  const rows = await loadLessons(supabase, dictionaryId, weeks);
  const template = rows.filter((r) => r.week_start === null);
  const templateBody = (weekday: number) => template.find((r) => r.weekday === weekday)?.body ?? "";

  const missing: { dictionary_id: string; week_start: string | null; weekday: number; body: string; updated_by: string }[] = [];
  for (const weekday of WEEKDAYS) {
    if (!template.some((r) => r.weekday === weekday)) {
      missing.push({ dictionary_id: dictionaryId, week_start: null, weekday, body: "", updated_by: userId });
    }
  }
  for (const week of weeks) {
    if (rows.some((r) => r.week_start === week)) continue;
    for (const weekday of WEEKDAYS) {
      missing.push({ dictionary_id: dictionaryId, week_start: week, weekday, body: templateBody(weekday), updated_by: userId });
    }
  }
  if (missing.length === 0) return rows;

  // Two members opening the same new week at once both try to copy it;
  // the unique index keeps one, and the reload picks it up.
  await supabase.from("after_school_lessons").insert(missing);
  return loadLessons(supabase, dictionaryId, weeks);
}

// Sets one day's lesson. week null is the template.
export async function setLesson(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  week: string | null,
  weekday: number,
  body: string,
): Promise<void> {
  const rows = await ensureLessonWeeks(supabase, dictionaryId, userId, week ? [week] : []);
  const row = rows.find((r) => r.week_start === week && r.weekday === weekday);
  if (!row) throw new Error("Couldn't find that lesson.");
  await updateLesson(supabase, userId, row.id, body);
}

export async function updateLesson(supabase: SupabaseClient, userId: string, id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from("after_school_lessons")
    .update({ body: body.slice(0, 5000), updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Copies the template over every day of the given weeks.
export async function regenerateWeeks(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  weeks: string[],
): Promise<void> {
  const rows = await ensureLessonWeeks(supabase, dictionaryId, userId, weeks);
  const now = new Date().toISOString();
  for (const weekday of WEEKDAYS) {
    const text = rows.find((r) => r.week_start === null && r.weekday === weekday)?.body ?? "";
    const { error } = await supabase
      .from("after_school_lessons")
      .update({ body: text, updated_by: userId, updated_at: now })
      .eq("dictionary_id", dictionaryId)
      .eq("weekday", weekday)
      .in("week_start", weeks);
    if (error) throw new Error(error.message);
  }
}

export type WeekRow = { week_start: string; theme: string; activities: string[] };

export async function loadWeeks(supabase: SupabaseClient, dictionaryId: string, weeks: string[]): Promise<WeekRow[]> {
  if (weeks.length === 0) return [];
  const { data, error } = await supabase
    .from("after_school_weeks")
    .select("week_start, theme, activities")
    .eq("dictionary_id", dictionaryId)
    .in("week_start", weeks);
  if (error) throw new Error(error.message);
  return (data ?? []) as WeekRow[];
}

export async function saveWeek(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string,
  week: WeekRow,
): Promise<void> {
  const { error } = await supabase.from("after_school_weeks").upsert(
    {
      dictionary_id: dictionaryId,
      week_start: week.week_start,
      theme: week.theme.slice(0, 200),
      activities: week.activities,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dictionary_id,week_start" },
  );
  if (error) throw new Error(error.message);
}
