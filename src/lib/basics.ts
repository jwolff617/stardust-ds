// The store's basic apps: small personal dictionaries that each hold one
// kind of record (Notepad pages, Address Book contacts, Birthdays). One
// config per app drives its table, its API, its Display View, and its Sage
// AI noun, so a new basic app is a migration plus an entry here. Pure,
// safe to import from client and server.

export type BasicFieldType = "text" | "longtext" | "integer";

export type BasicField = {
  key: string;
  label: string;
  type: BasicFieldType;
  required?: boolean;
  max?: number;
  min?: number;
};

export type BasicRecord = { id: string; createdAt: string; updatedAt: string } & Record<string, string | number | null>;

export type BasicApp = {
  // The display_kind of the app's copies.
  kind: string;
  // The template's address.
  address: string;
  table: string;
  noun: string;
  nounDescription: string;
  fields: BasicField[];
  // The field shown as each record's heading.
  titleField: string;
  addLabel: string;
  sort: (a: BasicRecord, b: BasicRecord) => number;
  // A record-level rule the fields alone can't say. Returns an error.
  check?: (record: Record<string, unknown>) => string | null;
  // A line under the heading, like "in 12 days".
  subtitle?: (record: BasicRecord) => string;
};

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Days from today to the next time month/day comes around. 0 is today.
// Feb 29 comes around on Feb 28 in other years.
export function daysUntil(month: number, day: number, from = new Date()): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const on = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return new Date(year, month - 1, month === 2 && day === 29 && !leap ? 28 : day);
  };
  let next = on(start.getFullYear());
  if (next < start) next = on(start.getFullYear() + 1);
  return Math.round((next.getTime() - start.getTime()) / 86400000);
}

function birthdaySubtitle(r: BasicRecord): string {
  const month = Number(r.month);
  const day = Number(r.day);
  const days = daysUntil(month, day);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const next = new Date();
  next.setDate(next.getDate() + days);
  const turning = r.year ? `, turns ${next.getFullYear() - Number(r.year)}` : "";
  return `${MONTHS[month - 1]} ${day}, ${when}${turning}`;
}

export const BASIC_APPS: BasicApp[] = [
  {
    kind: "notepad",
    address: "notepad-ds",
    table: "notepad_pages",
    noun: "Notepad Note",
    nounDescription: "A note in Notepad: plain text, no title. Notes stay until deleted. Newest first.",
    fields: [{ key: "body", label: "Note", type: "longtext", required: true, max: 50000 }],
    titleField: "body",
    addLabel: "New note",
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
  },
  {
    kind: "contacts",
    address: "address-book-ds",
    table: "contacts",
    noun: "Contact",
    nounDescription: "Someone in the Address Book: name, phone, email, address, notes.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, max: 200 },
      { key: "phone", label: "Phone", type: "text", max: 50 },
      { key: "email", label: "Email", type: "text", max: 200 },
      { key: "address", label: "Address", type: "longtext", max: 500 },
      { key: "notes", label: "Notes", type: "longtext", max: 5000 },
    ],
    titleField: "name",
    addLabel: "New contact name",
    sort: (a, b) => String(a.name).localeCompare(String(b.name)),
    subtitle: (r) => [r.phone, r.email].filter(Boolean).join(" · "),
  },
  {
    kind: "birthdays",
    address: "birthdays-ds",
    table: "birthdays",
    noun: "Birthday",
    nounDescription: "Someone's birthday: name, month (1-12), day, and the birth year if known.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, max: 200 },
      { key: "month", label: "Month", type: "integer", required: true, min: 1, max: 12 },
      { key: "day", label: "Day", type: "integer", required: true, min: 1, max: 31 },
      { key: "year", label: "Year", type: "integer", min: 1900, max: 2100 },
      { key: "notes", label: "Notes", type: "longtext", max: 2000 },
    ],
    titleField: "name",
    addLabel: "Whose birthday?",
    sort: (a, b) => daysUntil(Number(a.month), Number(a.day)) - daysUntil(Number(b.month), Number(b.day)),
    check: (r) =>
      r.month && r.day && Number(r.day) > DAYS_IN_MONTH[Number(r.month) - 1] ? "That month doesn't have that many days." : null,
    subtitle: birthdaySubtitle,
  },
];

export function basicApp(kind: unknown): BasicApp | undefined {
  return BASIC_APPS.find((a) => a.kind === kind);
}

// Cleans a full record against its app's fields. Returns the row or an
// error.
export function cleanRecord(
  app: BasicApp,
  input: Record<string, unknown>,
): { row: Record<string, string | number | null> } | { error: string } {
  const row: Record<string, string | number | null> = {};
  for (const f of app.fields) {
    const raw = input[f.key];
    if (f.type === "integer") {
      const empty = raw === undefined || raw === null || raw === "";
      const n = Number(raw);
      if (empty) {
        if (f.required) return { error: `${f.label} is required.` };
        row[f.key] = null;
      } else if (!Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
        return { error: `${f.label} must be a whole number from ${f.min} to ${f.max}.` };
      } else {
        row[f.key] = n;
      }
    } else {
      const text = typeof raw === "string" ? raw.trim().slice(0, f.max ?? 5000) : "";
      if (f.required && !text) return { error: `${f.label} is required.` };
      row[f.key] = text;
    }
  }
  const problem = app.check?.(row);
  if (problem) return { error: problem };
  return { row };
}
