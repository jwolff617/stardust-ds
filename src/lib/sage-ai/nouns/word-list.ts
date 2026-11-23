import type { SupabaseClient } from "@supabase/supabase-js";
import type { NounDef, VerbResult } from "../engine";

// Today's Word List (0049): one list per spark, at the top left of the page.
// "new word list", "delete word list", "add to word list hope",
// "remove from word list hope". It never deletes itself.

const fail = (error: string): VerbResult => ({ ok: false, error });

type Found = { kind: string; refId: string | null; word: string };

// What a word is, so clicking it opens the right thing: the user's own
// entry, note, or org first, then the dictionary, else a new word.
async function identify(supabase: SupabaseClient, userId: string, word: string): Promise<Found> {
  const w = word.trim();
  const { data: entry } = await supabase.from("profile_entries").select("id, kind, word").eq("owner_user_id", userId).ilike("word", w).limit(1).maybeSingle();
  if (entry) return { kind: entry.kind, refId: entry.id, word: entry.word };
  const { data: orgs } = await supabase.from("organization_members").select("organization:organizations(id, name)").eq("user_id", userId);
  for (const r of orgs ?? []) {
    const o = Array.isArray(r.organization) ? r.organization[0] : r.organization;
    if (o && o.name.toLowerCase() === w.toLowerCase()) return { kind: "organization", refId: o.id, word: o.name };
  }
  const { data: term } = await supabase.from("terms").select("id, name").ilike("name", w).limit(1).maybeSingle();
  if (term) {
    const { data: def } = await supabase
      .from("definitions")
      .select("id, part_of_speech, dictionary:dictionaries!inner(address)")
      .eq("term_id", term.id)
      .eq("dictionaries.address", "stardust")
      .maybeSingle();
    if (def) return { kind: def.part_of_speech === "verb" ? "verb" : "noun", refId: def.id, word: term.name };
  }
  // Not made yet: no type until it is created.
  return { kind: "new", refId: null, word: w };
}

async function hasList(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("word_lists").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export const wordListNoun: NounDef = {
  name: "Word List",
  dictionary: "core",
  alwaysOn: true,
  description:
    "Today's Word List, shown at the top left of the page. One at a time. Add makes it (\"new word list\", with optional starting words). Act Add Word / Remove Word change it. Delete erases it (ask first). It never deletes itself.",
  verbs: {
    Add: {
      description: "Make today's word list, with optional words.",
      params: [{ name: "words", type: "text", description: "Comma-separated words to start with." }],
      run: async ({ ctx, values }) => {
        if (await hasList(ctx.supabase, ctx.userId)) return fail("You already have a word list. Delete it first, or add words to it.");
        const { error } = await ctx.supabase.from("word_lists").insert({ user_id: ctx.userId });
        if (error) return fail(error.message);
        const words = String(values.words ?? "").split(",").map((w) => w.trim()).filter(Boolean).slice(0, 100);
        for (const [i, w] of words.entries()) {
          const f = await identify(ctx.supabase, ctx.userId, w);
          await ctx.supabase.from("word_list_words").insert({ user_id: ctx.userId, word: f.word, kind: f.kind, ref_id: f.refId, position: i });
        }
        ctx.emit?.({ type: "word-list" });
        return { ok: true, message: words.length ? `Made today's word list with ${words.length} words.` : "Made today's word list." };
      },
    },
    Find: {
      run: async ({ ctx }) => {
        const { data } = await ctx.supabase.from("word_list_words").select("word, kind").eq("user_id", ctx.userId).order("position");
        if (!(await hasList(ctx.supabase, ctx.userId))) return { ok: true, message: "No word list right now." };
        return { ok: true, message: `${data?.length ?? 0} words.`, data: (data ?? []).map((w) => `${w.word} (${w.kind})`) };
      },
    },
    Delete: {
      description: "Erase today's word list and its words. Ask first.",
      run: async ({ ctx }) => {
        const { error, count } = await ctx.supabase.from("word_lists").delete({ count: "exact" }).eq("user_id", ctx.userId);
        if (error) return fail(error.message);
        ctx.emit?.({ type: "word-list" });
        return count ? { ok: true, message: "Deleted your word list." } : { ok: true, message: "There was no word list." };
      },
    },
  },
  actions: {
    "Add Word": {
      description: "Add a word (or comma-separated words) to today's list. Makes the list if there isn't one.",
      params: [{ name: "word", type: "text", required: true, max: 600 }],
      run: async ({ ctx, values }) => {
        if (!(await hasList(ctx.supabase, ctx.userId))) {
          const { error } = await ctx.supabase.from("word_lists").insert({ user_id: ctx.userId });
          if (error) return fail(error.message);
        }
        const { count } = await ctx.supabase.from("word_list_words").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
        const words = String(values.word).split(",").map((w) => w.trim()).filter(Boolean);
        const added: string[] = [];
        for (const [i, w] of words.entries()) {
          const f = await identify(ctx.supabase, ctx.userId, w);
          const { error } = await ctx.supabase
            .from("word_list_words")
            .insert({ user_id: ctx.userId, word: f.word, kind: f.kind, ref_id: f.refId, position: (count ?? 0) + i });
          if (error && error.code !== "23505") return fail(error.message);
          if (!error) added.push(f.word);
        }
        ctx.emit?.({ type: "word-list" });
        return { ok: true, message: added.length ? `Added ${added.join(", ")}.` : "Already on your list." };
      },
    },
    "Remove Word": {
      params: [{ name: "word", type: "text", required: true, max: 120 }],
      run: async ({ ctx, values }) => {
        const { error, count } = await ctx.supabase
          .from("word_list_words")
          .delete({ count: "exact" })
          .eq("user_id", ctx.userId)
          .ilike("word", String(values.word).trim());
        if (error) return fail(error.message);
        ctx.emit?.({ type: "word-list" });
        return count ? { ok: true, message: `Removed ${values.word}.` } : fail(`"${values.word}" isn't on your list.`);
      },
    },
  },
};
