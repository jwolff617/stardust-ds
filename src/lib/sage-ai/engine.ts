import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mondayOf, toIsoDate } from "@/lib/after-school";
import { CUSTOM_ADDRESS, isCustomAddress } from "@/lib/custom";

// Sage AI's verb engine. Every tool is one Core verb. Every dictionary
// registers its nouns (what a thing is called, what fields it takes, which
// verbs work on it), and the engine checks the fields, finds the right
// dictionary copy, and runs the noun's handler. Adding a noun never adds a
// tool. Sage AI only sees the nouns of dictionaries the user has on.

export const CORE_VERBS = ["Add", "Edit", "Find", "Archive", "Restore", "Delete", "Share", "Label", "Remove"] as const;
export type CoreVerb = (typeof CORE_VERBS)[number];

export type FieldType = "text" | "number" | "integer" | "date" | "week" | "weekday" | "enum" | "enum[]";

export type Field = {
  name: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  // "week" fields only: also accept "template".
  allowTemplate?: boolean;
};

export type Values = Record<string, unknown>;

export type VerbResult = { ok: true; message: string; data?: unknown } | { ok: false; error: string };

export type DictionaryCopy = {
  id: string;
  name: string;
  // The template's address for a copy, else the dictionary's own.
  address: string;
  scope: string;
};

export type NounContext = {
  supabase: SupabaseClient;
  userId: string;
  displayName: string | null;
  timeZone: string;
  today: string;
  copies: DictionaryCopy[];
};

export type RunArgs = {
  ctx: NounContext;
  // The dictionary copy the noun lives in. Null for nouns that span
  // dictionaries (Core's Dictionary and Term).
  dictionary: DictionaryCopy | null;
  target: string | null;
  values: Values;
};

export type VerbDef = {
  description?: string;
  params?: Field[];
  // What target means for this verb, when it needs one.
  target?: string;
  run: (args: RunArgs) => Promise<VerbResult>;
};

export type NounDef = {
  name: string;
  // The address of the dictionary (or template) the noun belongs to.
  dictionary: string;
  description: string;
  // Available whenever its dictionary is on. Core nouns are always on.
  alwaysOn?: boolean;
  // Rules the model should know that don't fit a field.
  notes?: string;
  verbs: Partial<Record<CoreVerb, VerbDef>>;
  // Dictionary-specific verbs beyond the Core ones (Done, Regenerate),
  // run through the Act tool.
  actions?: Record<string, VerbDef>;
};

const WEEKDAY_NAMES = ["mon", "tue", "wed", "thu", "fri"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return toIsoDate(date) === value ? date : null;
}

// Checks and converts one field. Returns the clean value, or an error a
// model can fix on the next try.
function coerce(field: Field, raw: unknown): { value?: unknown; error?: string } {
  const label = `"${field.name}"`;
  switch (field.type) {
    case "text": {
      if (typeof raw !== "string") return { error: `${label} must be text.` };
      const max = field.max ?? 5000;
      return { value: raw.trim().slice(0, max) };
    }
    case "number":
    case "integer": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
      if (field.type === "integer" && !Number.isInteger(n)) return { error: `${label} must be a whole number.` };
      if (field.min !== undefined && n < field.min) return { error: `${label} must be at least ${field.min}.` };
      if (field.max !== undefined && n > field.max) return { error: `${label} must be at most ${field.max}.` };
      return { value: n };
    }
    case "date": {
      const s = String(raw).trim();
      return parseIsoDate(s) ? { value: s } : { error: `${label} must be a date like 2026-11-02.` };
    }
    case "week": {
      const s = String(raw).trim().toLowerCase();
      if (field.allowTemplate && s === "template") return { value: "template" };
      const date = parseIsoDate(s);
      if (!date) {
        return { error: `${label} must be a date like 2026-11-02${field.allowTemplate ? ' or "template"' : ""}.` };
      }
      return { value: mondayOf(date) };
    }
    case "weekday": {
      const s = String(raw).trim().toLowerCase();
      const n = Number(s);
      if (Number.isInteger(n) && n >= 1 && n <= 5) return { value: n };
      const i = WEEKDAY_NAMES.indexOf(s.slice(0, 3));
      return i >= 0 ? { value: i + 1 } : { error: `${label} must be Mon, Tue, Wed, Thu, or Fri.` };
    }
    case "enum": {
      const s = String(raw).trim().toLowerCase();
      const match = field.options?.find((o) => o.toLowerCase() === s);
      return match !== undefined ? { value: match } : { error: `${label} must be one of: ${field.options?.join(", ")}.` };
    }
    case "enum[]": {
      const list = Array.isArray(raw) ? raw : String(raw).split(",");
      const out: string[] = [];
      for (const item of list) {
        const s = String(item).trim().toLowerCase();
        if (!s) continue;
        const match = field.options?.find((o) => o.toLowerCase() === s);
        if (match === undefined) return { error: `${label} items must be from: ${field.options?.join(", ")}.` };
        if (!out.includes(match)) out.push(match);
      }
      return { value: out };
    }
  }
}

export function validate(params: Field[], raw: Values): { values: Values } | { error: string } {
  const values: Values = {};
  const known = new Set(params.map((p) => p.name));
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    return { error: `Unknown field(s): ${unknown.join(", ")}. This verb takes: ${params.map((p) => p.name).join(", ") || "nothing"}.` };
  }
  for (const field of params) {
    const value = raw[field.name];
    if (value === undefined || value === null || value === "") {
      if (field.required) return { error: `"${field.name}" is required.` };
      continue;
    }
    const result = coerce(field, value);
    if (result.error) return { error: result.error };
    values[field.name] = result.value;
  }
  return { values };
}

function describeField(field: Field): string {
  let type: string = field.type;
  if (field.type === "enum" || field.type === "enum[]") {
    type = field.options!.join("|") + (field.type === "enum[]" ? " (list)" : "");
  } else if (field.type === "week") {
    type = `a date, its week's Monday is used${field.allowTemplate ? ', or "template"' : ""}`;
  } else if (field.type === "weekday") {
    type = "Mon|Tue|Wed|Thu|Fri";
  }
  const range = field.min !== undefined || field.max !== undefined ? ` ${field.min ?? ""}..${field.max ?? ""}` : "";
  return `${field.name}${field.required ? "*" : ""} (${type}${field.type === "integer" ? range : ""})${field.description ? `: ${field.description}` : ""}`;
}

function describeVerb(name: string, verb: VerbDef): string {
  const params = verb.params ?? [];
  const parts = [
    verb.target ? `target = ${verb.target}` : null,
    params.length > 0 ? params.map(describeField).join("; ") : null,
  ].filter(Boolean);
  return `  - ${name}${verb.description ? `: ${verb.description}` : ""}${parts.length ? ` [${parts.join("; ")}]` : ""}`;
}

// The nouns the user can act on right now, written out for the system
// prompt. Fields marked * are required.
export function describeNouns(nouns: NounDef[], copies: DictionaryCopy[]): string {
  return nouns
    .map((noun) => {
      const inCopies = copies.filter((c) => c.address === noun.dictionary).map((c) => c.name);
      const where = noun.alwaysOn ? "always available" : `in ${inCopies.join(", ")}`;
      const lines = [
        `### ${noun.name} (${where})`,
        noun.description,
        ...(noun.notes ? [noun.notes] : []),
        ...Object.entries(noun.verbs).map(([v, def]) => describeVerb(v, def!)),
        ...Object.entries(noun.actions ?? {}).map(([v, def]) => describeVerb(`Act "${v}"`, def)),
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

// The dictionaries the user has on, each with the address its nouns are
// registered under.
export async function loadCopies(supabase: SupabaseClient): Promise<DictionaryCopy[]> {
  const { data } = await supabase
    .from("user_dictionaries")
    .select("dictionary:dictionaries(id, name, address, scope, template_id)")
    .eq("opted_in", true);

  type Row = { id: string; name: string; address: string; scope: string; template_id: string | null };
  const rows = (data ?? [])
    .map((r) => (Array.isArray(r.dictionary) ? r.dictionary[0] : r.dictionary) as Row | null)
    .filter((d): d is Row => Boolean(d));

  const templateIds = [...new Set(rows.map((d) => d.template_id).filter((id): id is string => Boolean(id)))];
  const addressById = new Map<string, string>();
  if (templateIds.length > 0) {
    const { data: templates } = await supabase.from("dictionaries").select("id, address").in("id", templateIds);
    for (const t of templates ?? []) addressById.set(t.id, t.address);
  }

  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    // Every dictionary someone built shares one noun.
    address: isCustomAddress(d.address) ? CUSTOM_ADDRESS : (d.template_id && addressById.get(d.template_id)) || d.address,
    scope: d.scope,
  }));
}

export function todayIn(timeZone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

export function availableNouns(all: NounDef[], copies: DictionaryCopy[]): NounDef[] {
  const on = new Set(copies.map((c) => c.address));
  return all.filter((n) => n.alwaysOn || on.has(n.dictionary));
}

const NOUN_INPUT = (nouns: string[]) => ({
  noun: { type: "string", enum: nouns, description: "What to act on." },
  dictionary: {
    type: "string",
    description: "Which dictionary copy, by name. Only needed when the user has more than one copy of the noun's dictionary.",
  },
  target: { type: "string", description: "Which one, as the noun's target says (a number, an id, or a name)." },
  params: { type: "object", description: "The fields this noun and verb take, listed in the system prompt." },
});

const VERB_HELP: Record<CoreVerb, string> = {
  Add: "Add a new thing, or turn a dictionary on.",
  Edit: "Change an existing thing.",
  Find: "Look things up.",
  Archive: "Set a thing aside without deleting it.",
  Restore: "Bring an archived thing back.",
  Delete: "Erase a thing for good.",
  Share: "Change who can see a thing.",
  Label: "Add or remove a label.",
  Remove: "Turn a dictionary off.",
};

// One tool per Core verb that at least one available noun supports, plus
// Act for dictionary-specific verbs.
export function buildTools(nouns: NounDef[]): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];
  for (const verb of CORE_VERBS) {
    const names = nouns.filter((n) => n.verbs[verb]).map((n) => n.name);
    if (names.length === 0) continue;
    tools.push({
      name: verb.toLowerCase(),
      description: `${verb}: ${VERB_HELP[verb]} Works on: ${names.join(", ")}. Each noun's target and fields are in the system prompt.`,
      input_schema: { type: "object", properties: NOUN_INPUT(names), required: ["noun"] },
    });
  }

  const actions = nouns.flatMap((n) => Object.keys(n.actions ?? {}).map((a) => `${a} (${n.name})`));
  if (actions.length > 0) {
    const verbs = [...new Set(nouns.flatMap((n) => Object.keys(n.actions ?? {})))];
    const names = nouns.filter((n) => n.actions && Object.keys(n.actions).length > 0).map((n) => n.name);
    tools.push({
      name: "act",
      description: `Act: a verb a dictionary adds beyond the Core ones. Available: ${actions.join(", ")}.`,
      input_schema: {
        type: "object",
        properties: { verb: { type: "string", enum: verbs }, ...NOUN_INPUT(names) },
        required: ["verb", "noun"],
      },
    });
  }
  return tools;
}

function pickCopy(noun: NounDef, ctx: NounContext, requested: unknown): DictionaryCopy | { error: string } {
  const copies = ctx.copies.filter((c) => c.address === noun.dictionary);
  if (copies.length === 0) return { error: `Turn on the dictionary for ${noun.name} first.` };
  if (typeof requested === "string" && requested.trim()) {
    const want = requested.trim().toLowerCase();
    const match = copies.find((c) => c.name.toLowerCase() === want) ?? copies.find((c) => c.name.toLowerCase().includes(want));
    if (!match) return { error: `No ${noun.name} dictionary named "${requested}". Options: ${copies.map((c) => c.name).join(", ")}.` };
    return match;
  }
  if (copies.length > 1) {
    return { error: `Which dictionary? ${noun.name} is in: ${copies.map((c) => c.name).join(", ")}.` };
  }
  return copies[0];
}

// Runs one tool call: finds the noun and verb, checks the fields, picks
// the dictionary copy, and hands off to the noun's handler.
export async function runTool(
  nouns: NounDef[],
  ctx: NounContext,
  toolName: string,
  input: Values,
): Promise<VerbResult> {
  const noun = nouns.find((n) => n.name.toLowerCase() === String(input.noun ?? "").trim().toLowerCase());
  if (!noun) return { ok: false, error: `Unknown noun "${input.noun}". Available: ${nouns.map((n) => n.name).join(", ")}.` };

  let verbName: string;
  let verb: VerbDef | undefined;
  if (toolName === "act") {
    verbName = String(input.verb ?? "");
    verb = Object.entries(noun.actions ?? {}).find(([name]) => name.toLowerCase() === verbName.toLowerCase())?.[1];
  } else {
    verbName = CORE_VERBS.find((v) => v.toLowerCase() === toolName) ?? toolName;
    verb = noun.verbs[verbName as CoreVerb];
  }
  if (!verb) return { ok: false, error: `${noun.name} doesn't support ${verbName}.` };

  const raw = input.params && typeof input.params === "object" ? (input.params as Values) : {};
  const checked = validate(verb.params ?? [], raw);
  if ("error" in checked) return { ok: false, error: checked.error };

  const target = input.target === undefined || input.target === null || input.target === "" ? null : String(input.target).trim();
  if (verb.target && target === null) return { ok: false, error: `${verbName} ${noun.name} needs a target: ${verb.target}.` };

  let dictionary: DictionaryCopy | null = null;
  if (!noun.alwaysOn) {
    const picked = pickCopy(noun, ctx, input.dictionary);
    if ("error" in picked) return { ok: false, error: picked.error };
    dictionary = picked;
  }

  try {
    return await verb.run({ ctx, dictionary, target, values: checked.values });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
