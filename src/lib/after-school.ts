// After School DS: lesson weeks and the theme calendar. Weeks are keyed by
// their Monday as a YYYY-MM-DD string in the viewer's local time. Pure
// functions, safe to import from client and server.

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const LESSON_WEEKS_SHOWN = 5;
export const ACTIVITY_COUNT = 5;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIsoDate(d);
}

export function addWeeks(weekStart: string, weeks: number): string {
  const d = parse(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return toIsoDate(d);
}

// A real date that falls on a Monday.
export function isWeekStart(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = parse(value);
  return toIsoDate(d) === value && d.getDay() === 1;
}

// Every Monday in a month: the weeks that month's calendar shows.
export function weeksInMonth(year: number, month: number): string[] {
  const d = new Date(year, month, 1);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  const weeks: string[] = [];
  while (d.getMonth() === month) {
    weeks.push(toIsoDate(d));
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

export function formatWeek(weekStart: string): string {
  return parse(weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMonth(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function normalizeActivities(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: ACTIVITY_COUNT }, (_, i) =>
    typeof list[i] === "string" ? list[i].slice(0, 500) : "",
  );
}
