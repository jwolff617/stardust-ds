// Basic apps: notebooks that each hold one kind of record. One config per
// app drives its table, its API, its view, and its Sage AI noun. Journal is
// the one left (journals, ideas, groups that write entries, Bet Stories).
// Pure, safe to import from client and server.

export type BasicFieldType = "text" | "longtext" | "integer";

export type BasicField = {
  key: string;
  label: string;
  type: BasicFieldType;
  required?: boolean;
  max?: number;
  min?: number;
};

export type BasicRecord = { id: string; createdAt: string; updatedAt: string; ownerId?: string } & Record<string, string | number | null | undefined>;

export type BasicApp = {
  // The display_kind of the app's copies.
  kind: string;
  // The template's address.
  address: string;
  table: string;
  noun: string;
  nounDescription: string;
  nounNotes?: string;
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

export const BASIC_APPS: BasicApp[] = [
  {
    kind: "journal",
    address: "journal-ds",
    table: "journal_entries",
    noun: "Journal Entry",
    nounDescription: "An entry in a Journal: what happened, how it felt. Dated by when it was written. Newest first. Private.",
    fields: [
      { key: "body", label: "Entry", type: "longtext", required: true, max: 50000 },
      { key: "place", label: "Place", type: "text", max: 120 },
      { key: "people", label: "People", type: "text", max: 300 },
    ],
    titleField: "body",
    addLabel: "What happened today?",
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
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
