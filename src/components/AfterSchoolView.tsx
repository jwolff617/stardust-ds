"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ACTIVITY_COUNT,
  WEEKDAYS,
  activitiesAsNotes,
  addMonths,
  addWeeks,
  formatWeek,
  formatWeekWithYear,
  mondayOf,
  weeksInYear,
} from "@/lib/after-school";
import { GroupMembers } from "./GroupMembers";

type GroupDictionary = { id: string; name: string };
type Lesson = { id: string; weekStart: string | null; weekday: number; body: string };
type Week = { weekStart: string; theme: string; activities: string[] };

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Something went wrong.");
  }
}

function emptyWeek(weekStart: string): Week {
  return { weekStart, theme: "", activities: Array(ACTIVITY_COUNT).fill("") };
}

// After School DS Display View: one week of Monday-to-Friday lesson notes
// at a time, a theme calendar listing a whole year, and a daily schedule,
// shared by everyone in the group.
export function AfterSchoolView({ dictionary, reloadKey = 0 }: { dictionary: GroupDictionary; reloadKey?: number }) {
  const [tab, setTab] = useState<"lessons" | "calendar" | "schedule">("lessons");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>
        {(["lessons", "calendar", "schedule"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === t ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
            }`}
          >
            {t === "lessons" ? "Lessons" : t === "calendar" ? "Calendar" : "Daily schedule"}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "lessons" && <LessonWeeks dictionaryId={dictionary.id} reloadKey={reloadKey} onError={setError} />}
      {tab === "calendar" && <ThemeCalendar dictionaryId={dictionary.id} reloadKey={reloadKey} onError={setError} />}
      {tab === "schedule" && <DailySchedule dictionaryId={dictionary.id} reloadKey={reloadKey} onError={setError} />}

      <GroupMembers dictionaryId={dictionary.id} reloadKey={reloadKey} onError={setError} />
    </div>
  );
}

function LessonWeeks({
  dictionaryId,
  reloadKey,
  onError,
}: {
  dictionaryId: string;
  reloadKey: number;
  onError: (message: string | null) => void;
}) {
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [themes, setThemes] = useState<Record<string, string>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoading, startLoading] = useTransition();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const weeks = [week];
  const weeksKey = week;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId, weeks: weeksKey });
    startLoading(async () => {
      try {
        const [lessonRes, weekRes] = await Promise.all([
          fetch(`/api/after-school/lessons?${params}`, { signal: controller.signal }),
          fetch(`/api/after-school/weeks?${params}`, { signal: controller.signal }),
        ]);
        const lessonData = await lessonRes.json();
        const weekData = await weekRes.json();
        if (!lessonRes.ok) throw new Error(lessonData.error ?? "Couldn't load lessons.");
        setLessons(lessonData.items ?? []);
        setThemes(
          Object.fromEntries((weekData.items ?? []).map((w: Week) => [w.weekStart, w.theme])),
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") onError((err as Error).message);
      }
    });
    return () => controller.abort();
  }, [dictionaryId, weeksKey, refreshToken, reloadKey, onError]);

  async function save(lesson: Lesson, body: string) {
    if (body === lesson.body) return;
    onError(null);
    setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, body } : l)));
    try {
      await post("/api/after-school/lessons", { id: lesson.id, body });
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function regenerate() {
    if (!window.confirm(`Copy the template into the week of ${formatWeekWithYear(week)}? This replaces what's in it.`)) return;
    onError(null);
    setIsRegenerating(true);
    try {
      await post("/api/after-school/regenerate", { dictionaryId, weeks });
    } catch (err) {
      onError((err as Error).message);
    }
    setIsRegenerating(false);
    setRefreshToken((t) => t + 1);
  }

  const dayOf = (weekStart: string | null, weekday: number) =>
    lessons.find((l) => l.weekStart === weekStart && l.weekday === weekday);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Template</p>
          <span className="text-xs text-neutral-500">New weeks start as a copy of this.</span>
          <button
            type="button"
            onClick={regenerate}
            disabled={isRegenerating || isLoading}
            title="Regenerate: copy the template into the week below"
            aria-label="Regenerate this week from the template"
            className="ml-auto rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-sm disabled:opacity-40"
          >
            ↻
          </button>
        </div>
        <DayRow lessonFor={(weekday) => dayOf(null, weekday)} onSave={save} refreshToken={refreshToken} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <JumpButton label="« 12 mo" title="Back 12 months" onClick={() => setWeek((w) => addMonths(w, -12))} />
        <JumpButton label="‹ 1 mo" title="Back 1 month" onClick={() => setWeek((w) => addMonths(w, -1))} />
        <JumpButton label="←" title="Previous week" onClick={() => setWeek((w) => addWeeks(w, -1))} />
        <span className="min-w-36 text-center font-medium">Week of {formatWeekWithYear(week)}</span>
        <JumpButton label="→" title="Next week" onClick={() => setWeek((w) => addWeeks(w, 1))} />
        <JumpButton label="1 mo ›" title="Ahead 1 month" onClick={() => setWeek((w) => addMonths(w, 1))} />
        <JumpButton label="12 mo »" title="Ahead 12 months" onClick={() => setWeek((w) => addMonths(w, 12))} />
        <button type="button" onClick={() => setWeek(mondayOf(new Date()))} className="text-xs text-neutral-500 underline">
          This week
        </button>
        {isLoading && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>

      {themes[week] && <p className="text-sm text-neutral-500">Theme: {themes[week]}</p>}
      <DayRow lessonFor={(weekday) => dayOf(week, weekday)} onSave={save} refreshToken={refreshToken} />
    </div>
  );
}

function JumpButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className="text-neutral-700 hover:text-neutral-900">
      {label}
    </button>
  );
}

// Monday to Friday, one box each. Saves when a box loses focus.
function DayRow({
  lessonFor,
  onSave,
  refreshToken,
}: {
  lessonFor: (weekday: number) => Lesson | undefined;
  onSave: (lesson: Lesson, body: string) => void;
  refreshToken: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {WEEKDAYS.map((label, i) => {
        const lesson = lessonFor(i + 1);
        return (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">{label}</span>
            <textarea
              key={`${lesson?.id ?? label}-${lesson?.body ?? ""}-${refreshToken}`}
              defaultValue={lesson?.body ?? ""}
              disabled={!lesson}
              rows={4}
              onBlur={(e) => lesson && onSave(lesson, e.target.value)}
              className="resize-y rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
            />
          </label>
        );
      })}
    </div>
  );
}

// A whole year of weeks on one page: a theme and notes for each. The notes
// are the week's activities, shown as one line.
function ThemeCalendar({
  dictionaryId,
  reloadKey,
  onError,
}: {
  dictionaryId: string;
  reloadKey: number;
  onError: (message: string | null) => void;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [saved, setSaved] = useState<Record<string, Week>>({});
  const [loads, setLoads] = useState(0);
  const [isLoading, startLoading] = useTransition();

  const weeks = weeksInYear(year);
  const weeksKey = weeks.join(",");
  const thisWeek = mondayOf(new Date());

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId, weeks: weeksKey });
    startLoading(async () => {
      try {
        const res = await fetch(`/api/after-school/weeks?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load the calendar.");
        setSaved(Object.fromEntries((data.items ?? []).map((w: Week) => [w.weekStart, w])));
        setLoads((n) => n + 1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") onError((err as Error).message);
      }
    });
    return () => controller.abort();
  }, [dictionaryId, weeksKey, reloadKey, onError]);

  async function save(week: Week) {
    onError(null);
    setSaved((prev) => ({ ...prev, [week.weekStart]: week }));
    try {
      await post("/api/after-school/weeks", { dictionaryId, ...week });
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
          ←
        </button>
        <span className="w-16 text-center font-medium">{year}</span>
        <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
          →
        </button>
        <button type="button" onClick={() => setYear(new Date().getFullYear())} className="text-xs text-neutral-500 underline">
          This year
        </button>
        {isLoading && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        {weeks.map((weekStart) => {
          const week = saved[weekStart] ?? emptyWeek(weekStart);
          const notes = activitiesAsNotes(week.activities);
          return (
            <div
              key={`${weekStart}-${loads}`}
              className={`flex items-center gap-2 border-b border-neutral-100 py-1 ${weekStart === thisWeek ? "bg-amber-50" : ""}`}
            >
              <span className="w-14 shrink-0 text-xs text-neutral-500">{formatWeek(weekStart)}</span>
              <input
                type="text"
                defaultValue={week.theme}
                maxLength={200}
                placeholder="Theme"
                onBlur={(e) => e.target.value !== week.theme && save({ ...week, theme: e.target.value })}
                className="w-1/3 min-w-0 rounded border border-transparent px-1.5 py-0.5 text-sm font-medium hover:border-neutral-200 focus:border-neutral-300"
              />
              <input
                type="text"
                defaultValue={notes}
                maxLength={500}
                placeholder="Notes"
                onBlur={(e) =>
                  e.target.value !== notes &&
                  save({ ...week, activities: [e.target.value, ...Array(ACTIVITY_COUNT - 1).fill("")] })
                }
                className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-0.5 text-sm hover:border-neutral-200 focus:border-neutral-300"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ScheduleRow = { id: string; time: string; activity: string; notes: string };

async function scheduleCall(dictionaryId: string, body: Record<string, unknown>) {
  await post("/api/after-school/schedule", { dictionaryId, ...body });
}

// The daily schedule: one row per block of the day, time then activity
// then notes. Type in a cell; it saves when you click away. Arrows move a
// row; ✕ deletes it.
function DailySchedule({
  dictionaryId,
  reloadKey,
  onError,
}: {
  dictionaryId: string;
  reloadKey: number;
  onError: (message: string | null) => void;
}) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loads, setLoads] = useState(0);
  const [token, setToken] = useState(0);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    const controller = new AbortController();
    startLoading(async () => {
      try {
        const res = await fetch(`/api/after-school/schedule?dictionaryId=${dictionaryId}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load the schedule.");
        setRows(data.items ?? []);
        setLoads((n) => n + 1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") onError((err as Error).message);
      }
    });
    return () => controller.abort();
  }, [dictionaryId, reloadKey, token, onError]);

  async function run(body: Record<string, unknown>, reload = true) {
    onError(null);
    try {
      await scheduleCall(dictionaryId, body);
      if (reload) setToken((t) => t + 1);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  function save(row: ScheduleRow, change: Partial<ScheduleRow>) {
    const next = { ...row, ...change };
    if (next.time === row.time && next.activity === row.activity && next.notes === row.notes) return;
    setRows((rs) => rs.map((r) => (r.id === row.id ? next : r)));
    run({ action: "save", ...next }, false);
  }

  function move(i: number, j: number) {
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(i, 1);
    next.splice(j, 0, row);
    setRows(next);
    run({ action: "move", ids: next.map((r) => r.id) }, false);
  }

  const cell = "w-full min-w-0 rounded border border-transparent px-1.5 py-1 text-sm hover:border-neutral-200 focus:border-neutral-300";

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden grid-cols-[7rem_1fr_1.4fr_auto] gap-2 px-1 text-xs font-medium text-neutral-500 sm:grid">
        <span>Time</span>
        <span>Activity</span>
        <span>Notes</span>
        <span className="w-16" />
      </div>
      {rows.length === 0 && !isLoading && (
        <p className="rounded-md border border-dashed border-neutral-300 px-3 py-4 text-center text-sm text-neutral-500">
          No schedule yet. Add the first row: a time, what happens, and any notes.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-neutral-100">
        {rows.map((row, i) => (
          <li key={`${row.id}-${loads}`} className="grid grid-cols-[5.5rem_1fr_auto] gap-x-2 gap-y-0.5 py-1 sm:grid-cols-[7rem_1fr_1.4fr_auto]">
            <input
              defaultValue={row.time}
              maxLength={40}
              placeholder="2:15"
              aria-label="Time"
              onBlur={(e) => save(row, { time: e.target.value })}
              className={`${cell} font-medium`}
            />
            <input
              defaultValue={row.activity}
              maxLength={200}
              placeholder="Activity"
              aria-label="Activity"
              onBlur={(e) => save(row, { activity: e.target.value })}
              className={cell}
            />
            <textarea
              defaultValue={row.notes}
              maxLength={2000}
              rows={1}
              placeholder="Notes"
              aria-label="Notes"
              onBlur={(e) => save(row, { notes: e.target.value })}
              className={`${cell} col-span-2 col-start-1 row-start-2 resize-y text-neutral-700 sm:col-span-1 sm:col-start-auto sm:row-start-auto`}
            />
            <div className="row-start-1 flex items-center gap-1 text-neutral-400 sm:row-start-auto">
              <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up" className="px-1 hover:text-neutral-900 disabled:opacity-30">
                ▲
              </button>
              <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down" className="px-1 hover:text-neutral-900 disabled:opacity-30">
                ▼
              </button>
              <button
                type="button"
                onClick={() => window.confirm("Delete this row?") && run({ action: "delete", id: row.id })}
                aria-label="Delete row"
                className="ml-1 px-1 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => run({ action: "add" })} className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:border-neutral-900">
          + Add row
        </button>
        {isLoading && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>
    </div>
  );
}
