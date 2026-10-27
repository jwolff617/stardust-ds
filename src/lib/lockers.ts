// Lockers and Lockers Admin: shapes and pure helpers, safe to import from
// client and server. Dates are YYYY-MM-DD strings.

export const LOCKER_COUNT = 500;

export type PostKind = "hours" | "rules" | "announcement";
export type Post = { id: string; kind: PostKind; body: string; createdAt: string };

export type Participant = {
  id: string;
  name: string;
  memberSince: string | null;
  renewedThru: string | null;
  shiftsRequired: number;
  notes: string;
  archived: boolean;
};

export type Locker = {
  number: number;
  participantId: string | null;
  assignedDate: string | null;
  broken: boolean;
  notes: string;
};

export type BarStatus = "recommended" | "issued" | "dismissed";
export type BarType = "temporary" | "permanent";
export type Bar = {
  id: string;
  participantId: string;
  status: BarStatus;
  type: BarType;
  reason: string;
  startDate: string;
  endDate: string | null;
};

export type AttendanceKind = "work" | "sunday" | "power_lunch" | "mandatory";
export type AttendanceStatus = "scheduled" | "present" | "missed";
export type Attendance = {
  participantId: string;
  date: string;
  kind: AttendanceKind;
  status: AttendanceStatus;
};

export const ATTENDANCE_KINDS: { key: AttendanceKind; label: string }[] = [
  { key: "work", label: "Work Shift" },
  { key: "sunday", label: "Sunday Meeting" },
  { key: "power_lunch", label: "Power Lunch" },
  { key: "mandatory", label: "Makeup Shift" },
];

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["scheduled", "present", "missed"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// An issued bar is in force until its end date. A permanent one never ends.
export function isActiveBar(bar: Bar, on = today()): boolean {
  if (bar.status !== "issued" || bar.startDate > on) return false;
  return bar.type === "permanent" || (bar.endDate !== null && bar.endDate >= on);
}

export function formatDate(date: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
