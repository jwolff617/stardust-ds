// Time frames: how long a Night DS note lives, and the ranges Worthy DS
// reports over. Pure functions, safe to import from client and server.

export const TIME_FRAMES = ["minute", "hour", "day", "week", "month", "year", "decade", "life"] as const;
export type TimeFrame = (typeof TIME_FRAMES)[number];

export const TIME_FRAME_LABELS: Record<TimeFrame, string> = {
  minute: "Minute",
  hour: "Hour",
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  decade: "Decade",
  life: "Life",
};

export const NOTE_LABELS = ["goal", "lesson", "memory", "idea", "person", "place"] as const;

export function isTimeFrame(value: unknown): value is TimeFrame {
  return typeof value === "string" && (TIME_FRAMES as readonly string[]).includes(value);
}

// One label per note: a preset or any custom word, lowercase, 1 to 40
// characters. Empty means no label.
export function normalizeNoteLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const label = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!label) return null;
  return label.slice(0, 40);
}

export function safeTimeZone(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return raw;
  } catch {
    return "UTC";
  }
}

// Milliseconds the given zone is ahead of UTC at a given instant.
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - (instant - (instant % 1000));
}

// The instant of the next local midnight after `from` in the given zone.
export function nextLocalMidnight(from: Date, timeZone: string): Date {
  const local = new Date(from.getTime() + zoneOffset(from.getTime(), timeZone));
  const midnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  let instant = midnightAsUtc - zoneOffset(midnightAsUtc, timeZone);
  // Daylight saving can shift the offset across the guess. One correction settles it.
  instant = midnightAsUtc - zoneOffset(instant, timeZone);
  return new Date(instant);
}

function addMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

// When a note with this time frame archives itself. A day note ends at the
// user's local midnight; the rest roll from `from`. Life never ends (null).
export function expiresAtFor(timeFrame: TimeFrame, from: Date, timeZone: string): Date | null {
  const t = from.getTime();
  switch (timeFrame) {
    case "minute":
      return new Date(t + 60_000);
    case "hour":
      return new Date(t + 3_600_000);
    case "day":
      return nextLocalMidnight(from, timeZone);
    case "week":
      return new Date(t + 7 * 86_400_000);
    case "month":
      return addMonths(from, 1);
    case "year":
      return addMonths(from, 12);
    case "decade":
      return addMonths(from, 120);
    case "life":
      return null;
  }
}

// The start of a rolling range ending now: the last day, week, and so on.
// Life has no start.
export function rangeStart(range: TimeFrame, now: Date): Date | null {
  if (range === "life") return null;
  const t = now.getTime();
  switch (range) {
    case "minute":
      return new Date(t - 60_000);
    case "hour":
      return new Date(t - 3_600_000);
    case "day":
      return new Date(t - 86_400_000);
    case "week":
      return new Date(t - 7 * 86_400_000);
    default:
      return addMonths(now, range === "month" ? -1 : range === "year" ? -12 : -120);
  }
}
