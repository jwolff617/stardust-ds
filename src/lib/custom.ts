// Dictionaries people build by talking to Sage AI (0028). Each has up to 8
// fields and uses the one shared Display View, so it works like every other
// dictionary. Pure, safe to import from client and server.

export type CustomFieldType = "text" | "longtext" | "number" | "date";
export type CustomField = { key: string; label: string; type: CustomFieldType };
export type CustomEntry = { id: string; values: Record<string, string>; labels: string[]; createdAt: string };

const TYPES: CustomFieldType[] = ["text", "longtext", "number", "date"];

// Every built dictionary shares this address for its Sage AI noun.
export const CUSTOM_ADDRESS = "custom";
export const isCustomAddress = (address: string) => address.startsWith("custom-");

// "Name, Notes (long), Cost (number), When (date)" into fields.
export function parseFields(input: unknown): CustomField[] | { error: string } {
  const parts = Array.isArray(input) ? input.map(String) : String(input ?? "").split(",");
  const fields: CustomField[] = [];
  for (const raw of parts) {
    const m = /^\s*(.*?)\s*(?:\((long|longtext|number|date|text)\))?\s*$/i.exec(raw);
    const label = (m?.[1] ?? "").slice(0, 40);
    if (!label) continue;
    const t = (m?.[2] ?? "text").toLowerCase();
    const type: CustomFieldType = t === "long" ? "longtext" : TYPES.includes(t as CustomFieldType) ? (t as CustomFieldType) : "text";
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "field";
    if (!/^[a-z]/.test(key)) key = `f_${key}`.slice(0, 30);
    while (fields.some((f) => f.key === key)) key = `${key.slice(0, 27)}_${fields.length}`;
    fields.push({ key, label, type });
  }
  if (fields.length === 0) return { error: "A dictionary needs at least one field." };
  if (fields.length > 8) return { error: "Keep it to 8 fields or fewer." };
  return fields;
}

export function fieldsOf(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is CustomField => Boolean(f) && typeof f.key === "string" && typeof f.label === "string" && TYPES.includes(f.type),
  );
}

// Checks one entry against the fields. The first field is required.
export function cleanValues(fields: CustomField[], input: unknown): Record<string, string> | { error: string } {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = String(raw[f.key] ?? "").trim().slice(0, f.type === "longtext" ? 5000 : 300);
    if (!v) continue;
    if (f.type === "number" && !Number.isFinite(Number(v.replace(/[$,]/g, "")))) return { error: `${f.label} should be a number.` };
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${f.label} should be a date, like 2026-10-29.` };
    values[f.key] = v;
  }
  if (fields[0] && !values[fields[0].key]) return { error: `${fields[0].label} is needed.` };
  return values;
}

// Sage AI sends an entry as plain text, "Label: value" per line. Lines
// without a known label go into the first field.
export function valuesFromText(fields: CustomField[], text: string): Record<string, string> {
  const values: Record<string, string> = {};
  const loose: string[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*([^:]{1,40}):\s*(.*)$/.exec(line);
    const field = m && fields.find((f) => f.label.toLowerCase() === m[1].trim().toLowerCase());
    if (field && m) values[field.key] = m[2].trim();
    else if (line.trim()) loose.push(line.trim());
  }
  if (fields[0] && loose.length > 0) {
    const first = fields[0].key;
    values[first] = [values[first], ...loose].filter(Boolean).join(fields[0].type === "longtext" ? "\n" : " ");
  }
  return values;
}
