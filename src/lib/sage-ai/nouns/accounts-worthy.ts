import { ACCOUNTS, ACCOUNT_GROUPS } from "@/lib/accounts";
import { BET_OUTCOMES, PRINCIPLES, PRINCIPLE_SHORT, WORTHY_KINDS, summarize, type WorthyEntry } from "@/lib/worthy";
import type { NounDef, VerbResult } from "../engine";

// Accounts DS entries, and Worthy DS money entries and Bet Stories.

async function deleteById(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  table: string,
  dictionaryId: string,
  id: string,
  what: string,
): Promise<VerbResult> {
  const { data, error } = await supabase.from(table).delete().eq("dictionary_id", dictionaryId).eq("id", id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: `No ${what} with id ${id}. Find it first to get its id.` };
  return { ok: true, message: `Deleted the ${what}.` };
}

export const entryNoun: NounDef = {
  name: "Account Entry",
  dictionary: "accounts-ds",
  description: `One dated line in an Accounts DS account: an amount, a note, or both. Accounts: ${ACCOUNT_GROUPS.map((g) => `${g.group} (${g.accounts.join(", ")})`).join("; ")}.`,
  verbs: {
    Add: {
      params: [
        { name: "account", type: "enum", options: ACCOUNTS, required: true },
        { name: "amount", type: "number", description: "Money, minutes, a count, whatever the user tracks." },
        { name: "note", type: "text", max: 2000 },
      ],
      run: async ({ ctx, dictionary, values }) => {
        if (values.amount === undefined && !values.note) return { ok: false, error: "An entry needs an amount, a note, or both." };
        const { error } = await ctx.supabase.from("account_entries").insert({
          dictionary_id: dictionary!.id,
          owner_user_id: ctx.userId,
          account: values.account,
          amount: values.amount ?? null,
          note: values.note || null,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Added an entry to ${values.account}.` };
      },
    },
    Find: {
      description: "Entries, newest first, with each account's balance.",
      params: [
        { name: "account", type: "enum", options: ACCOUNTS },
        { name: "query", type: "text", description: "Text in the note." },
      ],
      run: async ({ ctx, dictionary, values }) => {
        let q = ctx.supabase
          .from("account_entries")
          .select("id, account, amount, note, created_at")
          .eq("dictionary_id", dictionary!.id)
          .order("created_at", { ascending: false });
        if (values.account) q = q.eq("account", values.account);
        if (values.query) q = q.ilike("note", `%${values.query}%`);
        const { data, error } = await q.limit(200);
        if (error) return { ok: false, error: error.message };

        const balances: Record<string, { total: number; entries: number }> = {};
        for (const row of data ?? []) {
          const b = (balances[row.account] ??= { total: 0, entries: 0 });
          b.total += row.amount === null ? 0 : Number(row.amount);
          b.entries += 1;
        }
        return {
          ok: true,
          message: `Found ${data?.length ?? 0} entr${data?.length === 1 ? "y" : "ies"}.`,
          data: { balances, entries: (data ?? []).slice(0, 50) },
        };
      },
    },
    Delete: {
      target: "the entry's id from Find",
      run: ({ ctx, dictionary, target }) => deleteById(ctx.supabase, "account_entries", dictionary!.id, target!, "entry"),
    },
  },
};

export const worthyEntryNoun: NounDef = {
  name: "Worthy Entry",
  dictionary: "worthy-ds",
  description: "A money line in Worthy DS: deposit (put on a betting site), win (profit from a win), savings (moved out of betting, should be half of wins), or balance (a snapshot of the betting balance).",
  notes: "The rule: save half of every win.",
  verbs: {
    Add: {
      params: [
        { name: "kind", type: "enum", options: WORTHY_KINDS, required: true },
        { name: "amount", type: "number", min: 0, required: true },
        { name: "note", type: "text", max: 2000 },
        { name: "date", type: "date", description: "Default today." },
      ],
      run: async ({ ctx, dictionary, values }) => {
        const { error } = await ctx.supabase.from("worthy_entries").insert({
          dictionary_id: dictionary!.id,
          owner_user_id: ctx.userId,
          kind: values.kind,
          amount: values.amount,
          note: values.note || null,
          occurred_at: values.date ? new Date(`${values.date}T12:00:00`).toISOString() : new Date().toISOString(),
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Logged a ${values.kind} of $${Number(values.amount).toFixed(2)}.` };
      },
    },
    Find: {
      description: "Entries, newest first, plus the totals: deposits, wins, savings, savings owed, balance, loss.",
      run: async ({ ctx, dictionary }) => {
        const { data, error } = await ctx.supabase
          .from("worthy_entries")
          .select("id, kind, amount, note, occurred_at")
          .eq("dictionary_id", dictionary!.id)
          .order("occurred_at", { ascending: false });
        if (error) return { ok: false, error: error.message };
        const entries: WorthyEntry[] = (data ?? []).map((r) => ({ kind: r.kind, amount: Number(r.amount), occurredAt: r.occurred_at }));
        return { ok: true, message: `${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`, data: { summary: summarize(entries, null), entries: (data ?? []).slice(0, 50) } };
      },
    },
    Delete: {
      target: "the entry's id from Find",
      run: ({ ctx, dictionary, target }) => deleteById(ctx.supabase, "worthy_entries", dictionary!.id, target!, "entry"),
    },
  },
};

export const betStoryNoun: NounDef = {
  name: "Bet Story",
  dictionary: "worthy-ds",
  description: `A dated memory of one bet in Worthy DS: what happened and what the user was thinking. Principles: ${PRINCIPLES.map((p) => `${p} (${PRINCIPLE_SHORT[p]})`).join(", ")}.`,
  verbs: {
    Add: {
      params: [
        { name: "outcome", type: "enum", options: BET_OUTCOMES, required: true, description: "missed is a bet they thought of but didn't make." },
        { name: "body", type: "text", required: true },
        { name: "principles", type: "enum[]", options: PRINCIPLES },
        { name: "date", type: "date", description: "Default today." },
      ],
      run: async ({ ctx, dictionary, values }) => {
        const { error } = await ctx.supabase.from("bet_stories").insert({
          dictionary_id: dictionary!.id,
          owner_user_id: ctx.userId,
          outcome: values.outcome,
          body: values.body,
          principles: values.principles ?? [],
          occurred_on: values.date ?? ctx.today,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Saved a ${values.outcome} bet story.` };
      },
    },
    Find: {
      description: "Bet stories, newest first.",
      params: [
        { name: "query", type: "text" },
        { name: "outcome", type: "enum", options: BET_OUTCOMES },
      ],
      run: async ({ ctx, dictionary, values }) => {
        let q = ctx.supabase
          .from("bet_stories")
          .select("id, occurred_on, outcome, body, principles")
          .eq("dictionary_id", dictionary!.id)
          .order("occurred_on", { ascending: false });
        if (values.outcome) q = q.eq("outcome", values.outcome);
        if (values.query) q = q.ilike("body", `%${values.query}%`);
        const { data, error } = await q.limit(50);
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Found ${data?.length ?? 0} bet stor${data?.length === 1 ? "y" : "ies"}.`, data };
      },
    },
    Delete: {
      target: "the story's id from Find",
      run: ({ ctx, dictionary, target }) => deleteById(ctx.supabase, "bet_stories", dictionary!.id, target!, "bet story"),
    },
  },
};
