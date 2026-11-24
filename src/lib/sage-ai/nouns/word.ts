import type { NounDef, VerbResult } from "../engine";

// Word: a noun of the user's own, a word and what it means to them (0050).
const fail = (error: string): VerbResult => ({ ok: false, error });
const COLUMNS = "id, word, body, place, people";

export const wordNoun: NounDef = {
  name: "Word",
  dictionary: "core",
  alwaysOn: true,
  description: "A noun of the user's own: a word and what it means to them, with place and people. Always private. After Add or Edit, show it with kind \"mine\" and its id.",
  verbs: {
    Add: {
      params: [
        { name: "word", type: "text", required: true, max: 120 },
        { name: "body", type: "text", max: 20000 },
        { name: "place", type: "text", max: 120 },
        { name: "people", type: "text", max: 300 },
      ],
      run: async ({ ctx, values }) => {
        const { data, error } = await ctx.supabase
          .from("my_words")
          .insert({ owner_user_id: ctx.userId, word: values.word, body: values.body ?? "", place: values.place ?? "", people: values.people ?? "" })
          .select(COLUMNS)
          .single();
        if (error) return fail(error.message);
        return { ok: true, message: `Made ${data.word}.`, data };
      },
    },
    Edit: {
      target: "the word's id",
      params: [
        { name: "word", type: "text", max: 120 },
        { name: "body", type: "text", max: 20000 },
        { name: "place", type: "text", max: 120 },
        { name: "people", type: "text", max: 300 },
      ],
      run: async ({ ctx, target, values }) => {
        const update = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
        if (Object.keys(update).length === 0) return fail("Nothing to change.");
        const { data, error } = await ctx.supabase.from("my_words").update(update).eq("id", target!).eq("owner_user_id", ctx.userId).select(COLUMNS).maybeSingle();
        if (error) return fail(error.message);
        return data ? { ok: true, message: "Saved.", data } : fail("That's not one of your words.");
      },
    },
    Find: {
      params: [{ name: "query", type: "text" }],
      run: async ({ ctx, values }) => {
        let q = ctx.supabase.from("my_words").select(COLUMNS).eq("owner_user_id", ctx.userId).order("word").limit(50);
        if (values.query) q = q.ilike("word", `%${String(values.query)}%`);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return { ok: true, message: `${data?.length ?? 0} words.`, data: (data ?? []).map((w) => `${w.id} · ${w.word}`) };
      },
    },
    Delete: {
      target: "the word's id",
      run: async ({ ctx, target }) => {
        const { error, count } = await ctx.supabase.from("my_words").delete({ count: "exact" }).eq("id", target!).eq("owner_user_id", ctx.userId);
        if (error) return fail(error.message);
        return count ? { ok: true, message: "Deleted." } : fail("That's not one of your words.");
      },
    },
  },
};
