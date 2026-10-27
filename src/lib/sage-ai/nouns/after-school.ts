import { ACTIVITY_COUNT, LESSON_WEEKS_SHOWN, WEEKDAYS, addWeeks, mondayOf, normalizeActivities } from "@/lib/after-school";
import { ensureLessonWeeks, loadWeeks, regenerateWeeks, saveWeek, setLesson, type WeekRow } from "@/lib/after-school-db";
import type { NounContext, NounDef, RunArgs, VerbResult } from "../engine";

// After School DS: lesson weeks and a theme calendar, shared by the group.

function weekOrToday(ctx: NounContext, week: unknown): string {
  if (typeof week === "string") return week;
  const [y, m, d] = ctx.today.split("-").map(Number);
  return mondayOf(new Date(y, m - 1, d));
}

function nextWeeks(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addWeeks(start, i));
}

async function weekRow(args: RunArgs, week: string): Promise<WeekRow> {
  const [row] = await loadWeeks(args.ctx.supabase, args.dictionary!.id, [week]);
  return row
    ? { ...row, activities: normalizeActivities(row.activities) }
    : { week_start: week, theme: "", activities: Array(ACTIVITY_COUNT).fill("") };
}

async function setLessonVerb({ ctx, dictionary, values }: RunArgs): Promise<VerbResult> {
  const week = values.week === "template" ? null : String(values.week);
  const day = Number(values.day);
  await setLesson(ctx.supabase, dictionary!.id, ctx.userId, week, day, String(values.text ?? ""));
  const dayName = WEEKDAYS[day - 1];
  return { ok: true, message: week ? `Set ${dayName}'s lesson for the week of ${week}.` : `Set ${dayName} in the lesson template.` };
}

const lessonParams = [
  { name: "week", type: "week" as const, allowTemplate: true, required: true },
  { name: "day", type: "weekday" as const, required: true },
  { name: "text", type: "text" as const, required: true, description: "The whole lesson for that day. Replaces what's there." },
];

export const lessonNoun: NounDef = {
  name: "Lesson",
  dictionary: "after-school-ds",
  description: "The plan for one weekday (Mon to Fri) in a week, or in the lesson template every new week starts from.",
  notes: "Edit replaces the day's text, so Find it first if the user wants to add to what's there.",
  verbs: {
    Add: { description: "Write a day's lesson (same as Edit).", params: lessonParams, run: setLessonVerb },
    Edit: { params: lessonParams, run: setLessonVerb },
    Find: {
      description: `The template and the lessons for some weeks. Default: ${LESSON_WEEKS_SHOWN} weeks from this week.`,
      params: [
        { name: "week", type: "week", description: "The first week to show." },
        { name: "weeks", type: "integer", min: 1, max: 10 },
      ],
      run: async ({ ctx, dictionary, values }) => {
        const weeks = nextWeeks(weekOrToday(ctx, values.week), Number(values.weeks ?? LESSON_WEEKS_SHOWN));
        const rows = await ensureLessonWeeks(ctx.supabase, dictionary!.id, ctx.userId, weeks);
        const byWeek = (week: string | null) =>
          Object.fromEntries(
            WEEKDAYS.map((name, i) => [name, rows.find((r) => r.week_start === week && r.weekday === i + 1)?.body ?? ""]),
          );
        return {
          ok: true,
          message: `Template plus ${weeks.length} week(s).`,
          data: { template: byWeek(null), weeks: weeks.map((w) => ({ week: w, days: byWeek(w) })) },
        };
      },
    },
  },
  actions: {
    Regenerate: {
      description: `Copy the lesson template over every day of some weeks, replacing what's there. Confirm with the user first. Default: ${LESSON_WEEKS_SHOWN} weeks from this week.`,
      params: [
        { name: "week", type: "week", description: "The first week." },
        { name: "weeks", type: "integer", min: 1, max: 10 },
      ],
      run: async ({ ctx, dictionary, values }) => {
        const weeks = nextWeeks(weekOrToday(ctx, values.week), Number(values.weeks ?? LESSON_WEEKS_SHOWN));
        await regenerateWeeks(ctx.supabase, dictionary!.id, ctx.userId, weeks);
        return { ok: true, message: `Copied the template into ${weeks.length} week(s) starting ${weeks[0]}.` };
      },
    },
  },
};

async function findWeeks({ ctx, dictionary, values }: RunArgs): Promise<VerbResult> {
  const weeks = nextWeeks(weekOrToday(ctx, values.week), Number(values.weeks ?? 5));
  const rows = await loadWeeks(ctx.supabase, dictionary!.id, weeks);
  return {
    ok: true,
    message: `${weeks.length} week(s) of the calendar.`,
    data: weeks.map((w) => {
      const row = rows.find((r) => r.week_start === w);
      return { week: w, theme: row?.theme ?? "", activities: normalizeActivities(row?.activities) };
    }),
  };
}

const findWeeksVerb = {
  description: "The calendar's themes and activities for some weeks. Default: 5 weeks from this week.",
  params: [
    { name: "week", type: "week" as const, description: "The first week." },
    { name: "weeks", type: "integer" as const, min: 1, max: 26 },
  ],
  run: findWeeks,
};

export const themeNoun: NounDef = {
  name: "Theme",
  dictionary: "after-school-ds",
  description: "What a week is about, on the calendar.",
  verbs: {
    Add: {
      params: [
        { name: "week", type: "week", required: true },
        { name: "theme", type: "text", required: true, max: 200 },
      ],
      run: async (args) => {
        const week = String(args.values.week);
        await saveWeek(args.ctx.supabase, args.dictionary!.id, args.ctx.userId, { ...(await weekRow(args, week)), theme: String(args.values.theme) });
        return { ok: true, message: `The week of ${week} is now "${args.values.theme}".` };
      },
    },
    Edit: {
      params: [
        { name: "week", type: "week", required: true },
        { name: "theme", type: "text", required: true, max: 200 },
      ],
      run: async (args) => {
        const week = String(args.values.week);
        await saveWeek(args.ctx.supabase, args.dictionary!.id, args.ctx.userId, { ...(await weekRow(args, week)), theme: String(args.values.theme) });
        return { ok: true, message: `The week of ${week} is now "${args.values.theme}".` };
      },
    },
    Find: findWeeksVerb,
    Delete: {
      description: "Clear a week's theme. Its activities stay.",
      params: [{ name: "week", type: "week", required: true }],
      run: async (args) => {
        const week = String(args.values.week);
        await saveWeek(args.ctx.supabase, args.dictionary!.id, args.ctx.userId, { ...(await weekRow(args, week)), theme: "" });
        return { ok: true, message: `Cleared the theme for the week of ${week}.` };
      },
    },
  },
};

export const activityNoun: NounDef = {
  name: "Activity",
  dictionary: "after-school-ds",
  description: `One of the ${ACTIVITY_COUNT} activity slots in a calendar week.`,
  verbs: {
    Add: {
      description: "Put an activity in the first empty slot of a week.",
      params: [
        { name: "week", type: "week", required: true },
        { name: "text", type: "text", required: true, max: 500 },
      ],
      run: async (args) => {
        const week = String(args.values.week);
        const row = await weekRow(args, week);
        const slot = row.activities.findIndex((a) => !a.trim());
        if (slot < 0) return { ok: false, error: `The week of ${week} has all ${ACTIVITY_COUNT} activities. Edit one by its slot instead.` };
        row.activities[slot] = String(args.values.text);
        await saveWeek(args.ctx.supabase, args.dictionary!.id, args.ctx.userId, row);
        return { ok: true, message: `Added activity ${slot + 1} to the week of ${week}.` };
      },
    },
    Edit: {
      params: [
        { name: "week", type: "week", required: true },
        { name: "slot", type: "integer", min: 1, max: ACTIVITY_COUNT, required: true },
        { name: "text", type: "text", required: true, max: 500 },
      ],
      run: async (args) => {
        const week = String(args.values.week);
        const row = await weekRow(args, week);
        row.activities[Number(args.values.slot) - 1] = String(args.values.text);
        await saveWeek(args.ctx.supabase, args.dictionary!.id, args.ctx.userId, row);
        return { ok: true, message: `Set activity ${args.values.slot} for the week of ${week}.` };
      },
    },
    Find: findWeeksVerb,
    Delete: {
      description: "Clear one activity slot.",
      params: [
        { name: "week", type: "week", required: true },
        { name: "slot", type: "integer", min: 1, max: ACTIVITY_COUNT, required: true },
      ],
      run: async (args) => {
        const week = String(args.values.week);
        const row = await weekRow(args, week);
        row.activities[Number(args.values.slot) - 1] = "";
        await saveWeek(args.ctx.supabase, args.dictionary!.id, args.ctx.userId, row);
        return { ok: true, message: `Cleared activity ${args.values.slot} for the week of ${week}.` };
      },
    },
  },
};
