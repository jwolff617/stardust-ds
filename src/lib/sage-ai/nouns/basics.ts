import { BASIC_APPS, type BasicApp } from "@/lib/basics";
import { addRecord, deleteRecord, editRecord, listRecords } from "@/lib/basics-db";
import type { Field, NounDef, VerbResult } from "../engine";

// The basic apps' nouns (Page, Contact, Birthday), made from the same
// config as their tables and Display Views.

function fieldsOf(app: BasicApp, requireRequired: boolean): Field[] {
  return app.fields.map((f) => ({
    name: f.key,
    type: f.type === "integer" ? "integer" : "text",
    required: requireRequired && f.required,
    min: f.min,
    max: f.max,
  }));
}

async function attempt(work: () => Promise<VerbResult>): Promise<VerbResult> {
  try {
    return await work();
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function nounFor(app: BasicApp): NounDef {
  const what = app.noun.toLowerCase();
  const target = `the ${what}'s id from Find`;
  return {
    name: app.noun,
    dictionary: app.address,
    description: app.nounDescription,
    verbs: {
      Add: {
        params: fieldsOf(app, true),
        run: ({ ctx, dictionary, values }) =>
          attempt(async () => {
            const r = await addRecord(ctx.supabase, app, dictionary!.id, ctx.userId, values);
            return { ok: true, message: `Added ${String(r[app.titleField])}.`, data: r };
          }),
      },
      Edit: {
        description: "Changes only the fields given.",
        target,
        params: fieldsOf(app, false),
        run: ({ ctx, dictionary, target: id, values }) =>
          attempt(async () => {
            const r = await editRecord(ctx.supabase, app, dictionary!.id, id!, values);
            return { ok: true, message: `Updated ${String(r[app.titleField])}.`, data: r };
          }),
      },
      Find: {
        description: `${app.noun}s in order${app.subtitle ? ", each with a summary line" : ""}.`,
        params: [{ name: "query", type: "text", description: "Text to look for. Empty matches everything." }],
        run: ({ ctx, dictionary, values }) =>
          attempt(async () => {
            const records = await listRecords(ctx.supabase, app, dictionary!.id, values.query as string | undefined);
            return {
              ok: true,
              message: `Found ${records.length} ${what}${records.length === 1 ? "" : "s"}.`,
              data: records.slice(0, 50).map((r) => (app.subtitle ? { ...r, summary: app.subtitle(r) } : r)),
            };
          }),
      },
      Delete: {
        target,
        run: ({ ctx, dictionary, target: id }) =>
          attempt(async () => {
            await deleteRecord(ctx.supabase, app, dictionary!.id, id!);
            return { ok: true, message: `Deleted the ${what}.` };
          }),
      },
    },
  };
}

export const basicNouns: NounDef[] = BASIC_APPS.map(nounFor);
