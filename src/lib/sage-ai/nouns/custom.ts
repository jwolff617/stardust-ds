import { CUSTOM_ADDRESS, valuesFromText } from "@/lib/custom";
import { createCustomDictionary, deleteCustomDictionary, deleteEntry, loadEntries, loadFields, saveEntry } from "@/lib/custom-db";
import type { NounDef, VerbResult } from "../engine";

// Building a dictionary by talking to Sage AI, and the entries in it.
// Every built dictionary is personal (only its owner sees it), uses the one
// shared Display View, and is ready the moment it's made.

const ok = (message: string, data?: unknown): VerbResult => ({ ok: true, message, data });
const fail = (error: string): VerbResult => ({ ok: false, error });

export const builtDictionaryNoun: NounDef = {
  name: "Built Dictionary",
  dictionary: "core",
  alwaysOn: true,
  description: "A personal dictionary the user builds by describing what they need: a name and up to 8 fields. It's private, ready at once, and shows in their Display View.",
  notes:
    "When someone has a problem a dictionary could hold (tracking, a list, a log), offer to build one. Keep it lean: the fewest fields that do the job, usually 2 to 4, the most important first. " +
    "Fields are comma-separated; mark a type in parentheses: (long) for paragraphs, (number), (date). No mark means short text. Example: 'Song, Artist, Why I love it (long), Heard on (date)'. " +
    "Say what you'll build before you build it unless they already told you exactly.",
  verbs: {
    Add: {
      description: "Build a new personal dictionary and turn it on.",
      params: [
        { name: "name", type: "text", required: true, max: 60, description: "Short and plain, e.g. 'Songs I Love'." },
        { name: "description", type: "text", max: 300, description: "One line on what it's for." },
        { name: "fields", type: "text", required: true, max: 400, description: "Comma-separated field names with optional (long), (number), (date)." },
      ],
      run: async ({ ctx, values }) => {
        const r = await createCustomDictionary(ctx.supabase, String(values.name), String(values.description ?? ""), values.fields);
        return r.ok ? ok(`Built "${values.name}". It's on and ready in the Display View.`, { id: r.id }) : fail(r.error);
      },
    },
    Delete: {
      description: "Delete a dictionary the user built, with everything in it. Ask first.",
      target: "the built dictionary's name",
      run: async ({ ctx, target }) => {
        const copy = ctx.copies.find((c) => c.address === CUSTOM_ADDRESS && c.name.toLowerCase() === target!.toLowerCase());
        if (!copy) return fail(`No dictionary you built is named "${target}".`);
        const r = await deleteCustomDictionary(ctx.supabase, copy.id);
        return r.ok ? ok(`Deleted "${copy.name}".`) : fail(r.error);
      },
    },
  },
};

export const builtEntryNoun: NounDef = {
  name: "Entry",
  dictionary: CUSTOM_ADDRESS,
  description: "One entry in a dictionary the user built. Find shows each dictionary's fields.",
  notes: "Write entries as 'Field label: value' lines. Anything without a label goes in the first field. Dates as YYYY-MM-DD.",
  verbs: {
    Add: {
      params: [
        { name: "text", type: "text", required: true, max: 6000, description: "'Field: value' lines." },
        { name: "labels", type: "text", max: 200, description: "Comma-separated labels." },
      ],
      run: async ({ ctx, dictionary, values }) => {
        const fields = await loadFields(ctx.supabase, dictionary!.id);
        if (!fields) return fail("That isn't a dictionary you built.");
        const r = await saveEntry(ctx.supabase, dictionary!.id, { values: valuesFromText(fields, String(values.text)), labels: values.labels });
        return r.ok ? ok(`Added it to ${dictionary!.name}.`, { id: r.id }) : fail(r.error);
      },
    },
    Find: {
      description: "The dictionary's fields and its entries, newest first.",
      params: [{ name: "query", type: "text", max: 100 }],
      run: async ({ ctx, dictionary, values }) => {
        const fields = await loadFields(ctx.supabase, dictionary!.id);
        if (!fields) return fail("That isn't a dictionary you built.");
        const entries = await loadEntries(ctx.supabase, dictionary!.id, String(values.query ?? ""));
        return ok(`${entries.length} entr${entries.length === 1 ? "y" : "ies"} in ${dictionary!.name}.`, {
          fields: fields.map((f) => `${f.label} (${f.type})`),
          entries: entries.slice(0, 50),
        });
      },
    },
    Edit: {
      description: "Replaces the entry's fields with the ones given.",
      target: "the entry's id from Find",
      params: [
        { name: "text", type: "text", required: true, max: 6000 },
        { name: "labels", type: "text", max: 200 },
      ],
      run: async ({ ctx, dictionary, target, values }) => {
        const fields = await loadFields(ctx.supabase, dictionary!.id);
        if (!fields) return fail("That isn't a dictionary you built.");
        const r = await saveEntry(ctx.supabase, dictionary!.id, { values: valuesFromText(fields, String(values.text)), labels: values.labels }, target!);
        return r.ok ? ok("Updated it.") : fail(r.error);
      },
    },
    Delete: {
      target: "the entry's id from Find",
      run: async ({ ctx, dictionary, target }) => {
        const r = await deleteEntry(ctx.supabase, dictionary!.id, target!);
        return r.ok ? ok("Deleted it.") : fail(r.error);
      },
    },
  },
};
