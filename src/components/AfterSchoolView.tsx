"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ACTIVITY_COUNT,
  LESSON_WEEKS_SHOWN,
  WEEKDAYS,
  addWeeks,
  formatMonth,
  formatWeek,
  mondayOf,
  weeksInMonth,
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

// After School DS Display View: Monday-to-Friday lesson notes and a theme
// calendar, shared by everyone in the group.
export function AfterSchoolView({ dictionary, reloadKey = 0 }: { dictionary: GroupDictionary; reloadKey?: number }) {
  const [tab, setTab] = useState<"lessons" | "calendar">("lessons");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>
        {(["lessons", "calendar"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === t ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
            }`}
          >
            {t === "lessons" ? "Lessons" : "Calendar"}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "lessons" ? (
        <LessonWeeks dictionaryId={dictionary.id} reloadKey={reloadKey} onError={setError} />
      ) : (
        <ThemeCalendar dictionaryId={dictionary.id} reloadKey={reloadKey} onError={setError} />
      )}

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
  const [firstWeek, setFirstWeek] = useState(() => mondayOf(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [themes, setThemes] = useState<Record<string, string>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoading, startLoading] = useTransition();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const weeks = Array.from({ length: LESSON_WEEKS_SHOWN }, (_, i) => addWeeks(firstWeek, i));
  const weeksKey = weeks.join(",");

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
    if (!window.confirm(`Copy the template into all ${LESSON_WEEKS_SHOWN} weeks shown? This replaces what's in them.`)) return;
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
            title={`Regenerate: copy the template into the ${LESSON_WEEKS_SHOWN} weeks below`}
            aria-label="Regenerate weeks from the template"
            className="ml-auto rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-sm disabled:opacity-40"
          >
            ↻
          </button>
        </div>
        <DayRow lessonFor={(weekday) => dayOf(null, weekday)} onSave={save} refreshToken={refreshToken} />
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => setFirstWeek((w) => addWeeks(w, -LESSON_WEEKS_SHOWN))}>
          ← Earlier
        </button>
        <button
          type="button"
          onClick={() => setFirstWeek(mondayOf(new Date()))}
          className="text-xs text-neutral-500 underline"
        >
          This week
        </button>
        <button type="button" onClick={() => setFirstWeek((w) => addWeeks(w, LESSON_WEEKS_SHOWN))}>
          Later →
        </button>
        {isLoading && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>

      {weeks.map((week) => (
        <div key={week} className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Week of {formatWeek(week)}
            {themes[week] && <span className="ml-2 font-normal text-neutral-500">{themes[week]}</span>}
          </p>
          <DayRow lessonFor={(weekday) => dayOf(week, weekday)} onSave={save} refreshToken={refreshToken} />
        </div>
      ))}
    </div>
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

function ThemeCalendar({
  dictionaryId,
  reloadKey,
  onError,
}: {
  dictionaryId: string;
  reloadKey: number;
  onError: (message: string | null) => void;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [saved, setSaved] = useState<Record<string, Week>>({});
  const [isLoading, startLoading] = useTransition();

  const weeks = weeksInMonth(month.year, month.month);
  const weeksKey = weeks.join(",");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId, weeks: weeksKey });
    startLoading(async () => {
      try {
        const res = await fetch(`/api/after-school/weeks?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load the calendar.");
        setSaved(Object.fromEntries((data.items ?? []).map((w: Week) => [w.weekStart, w])));
      } catch (err) {
        if ((err as Error).name !== "AbortError") onError((err as Error).message);
      }
    });
    return () => controller.abort();
  }, [dictionaryId, weeksKey, reloadKey, onError]);

  function shiftMonth(delta: number) {
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ←
        </button>
        <span className="w-36 text-center font-medium">{formatMonth(month.year, month.month)}</span>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
          →
        </button>
        {isLoading && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>

      {weeks.map((weekStart) => {
        const week = saved[weekStart] ?? emptyWeek(weekStart);
        return (
          <div key={`${weekStart}-${reloadKey}`} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm font-medium">Week of {formatWeek(weekStart)}</span>
              <input
                type="text"
                defaultValue={week.theme}
                maxLength={200}
                placeholder="Theme"
                onBlur={(e) => e.target.value !== week.theme && save({ ...week, theme: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              {week.activities.map((activity, i) => (
                <input
                  key={i}
                  type="text"
                  defaultValue={activity}
                  maxLength={500}
                  placeholder={`Activity ${i + 1}`}
                  onBlur={(e) => {
                    if (e.target.value === activity) return;
                    const activities = [...week.activities];
                    activities[i] = e.target.value;
                    save({ ...week, activities });
                  }}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
