import { cleanDetails, detailsLine, ENTRY_COLUMNS, ENTRY_KINDS, RELATIONSHIPS, toEntry, type EntryKind } from "@/lib/profile-entries";
import type { Field, NounDef, VerbResult } from "../engine";

// Profile entries: what a spark offers or seeks (a person, an idea, a job, a
// resource). Matching is Sage searching these. No dictionary needed.

const KIND_FIELD: Field = { name: "kind", type: "enum", options: ENTRY_KINDS, description: "person, idea, job, or resource." };
const SIDE_FIELD: Field = {
  name: "side",
  type: "enum",
  options: ["offer", "seek"],
  description: "offer: who I am / my idea / hiring / have. seek: who I hope to meet / an idea to join / looking for work / need.",
};
const ENTRY_FIELDS: Field[] = [
  { name: "word", type: "text", max: 120, description: "A short title." },
  { name: "body", type: "text", max: 5000, description: "What they wrote about it." },
  { name: "place", type: "text", max: 120 },
  { name: "people", type: "text", max: 300 },
  { name: "visibility", type: "enum", options: ["public", "private"], description: "Default public." },
  { name: "relationship", type: "enum", options: RELATIONSHIPS, description: "person only." },
  { name: "age", type: "integer", min: 18, max: 120, description: "romance only." },
  { name: "iam", type: "enum", options: ["woman", "man", "nonbinary"], description: "romance only." },
  { name: "meet", type: "enum", options: ["women", "men", "everyone"], description: "romance only." },
  { name: "age_min", type: "integer", min: 18, max: 120, description: "romance only." },
  { name: "age_max", type: "integer", min: 18, max: 120, description: "romance only." },
  { name: "pay", type: "text", max: 60, description: "job only." },
  { name: "deal", type: "enum", options: ["free", "sale", "trade"], description: "resource only." },
  { name: "price", type: "text", max: 60, description: "resource only, when for sale." },
];

const DETAIL_KEYS = ["relationship", "age", "iam", "meet", "age_min", "age_max", "pay", "deal", "price"];
const TARGET = "the entry's id, from Find or Match";

function oneLine(e: { id: string; kind: string; side: string; word: string; ownerName?: string; place: string; details: Record<string, string> }) {
  const extra = detailsLine({ kind: e.kind as EntryKind, details: e.details });
  return `${e.id} · ${e.kind}/${e.side} · ${e.word}${e.ownerName ? ` · by ${e.ownerName}` : ""}${e.place ? ` · ${e.place}` : ""}${extra ? ` · ${extra}` : ""}`;
}

const fail = (error: string): VerbResult => ({ ok: false, error });

export const profileEntryNoun: NounDef = {
  name: "Profile Entry",
  dictionary: "core",
  alwaysOn: true,
  description:
    "One thing on the user's Profile: a person (who they are or hope to meet: romance, friendship, business), an idea, a job, or a resource. Offered or sought. Public by default. This is how ideas, jobs, people, and resources get matched.",
  notes:
    "Romance needs 18+ (Act Confirm Age first, with their birth date) and age, iam, meet, age_min, age_max. Others only see someone's romance entry through Match, and only when both fit. After Add or Edit, show the entry on the page.",
  verbs: {
    Add: {
      params: [{ ...KIND_FIELD, required: true }, { ...SIDE_FIELD, required: true }, ...ENTRY_FIELDS.map((f) => (f.name === "word" ? { ...f, required: true } : f))],
      run: async ({ ctx, values }) => {
        const kind = values.kind as EntryKind;
        const details = cleanDetails(kind, values);
        if (kind === "person" && !details.relationship) return fail("A person entry needs relationship: romance, friendship, or business.");
        const { data, error } = await ctx.supabase
          .from("profile_entries")
          .insert({
            owner_user_id: ctx.userId,
            kind,
            side: values.side,
            word: values.word,
            body: values.body ?? "",
            place: values.place ?? "",
            people: values.people ?? "",
            visibility: values.visibility ?? "public",
            details,
          })
          .select(ENTRY_COLUMNS)
          .single();
        if (error) return fail(error.message);
        const e = toEntry(data, ctx.userId);
        return { ok: true, message: `Added to your profile: ${e.word}.`, data: oneLine(e) };
      },
    },
    Edit: {
      target: TARGET,
      params: [SIDE_FIELD, ...ENTRY_FIELDS],
      run: async ({ ctx, target, values }) => {
        const { data: old } = await ctx.supabase.from("profile_entries").select(ENTRY_COLUMNS).eq("id", target!).eq("owner_user_id", ctx.userId).maybeSingle();
        if (!old) return fail("That's not one of your entries.");
        const update: Record<string, unknown> = {};
        for (const k of ["side", "word", "body", "place", "people", "visibility"]) if (values[k] !== undefined) update[k] = values[k];
        if (DETAIL_KEYS.some((k) => values[k] !== undefined)) {
          update.details = cleanDetails(old.kind as EntryKind, { ...(old.details ?? {}), ...values });
        }
        if (Object.keys(update).length === 0) return fail("Nothing to change.");
        const { error } = await ctx.supabase.from("profile_entries").update(update).eq("id", target!);
        if (error) return fail(error.message);
        return { ok: true, message: "Saved." };
      },
    },
    Find: {
      description: "The user's own entries.",
      params: [KIND_FIELD, { name: "query", type: "text" }],
      run: async ({ ctx, values }) => {
        let q = ctx.supabase.from("profile_entries").select(ENTRY_COLUMNS).eq("owner_user_id", ctx.userId).order("created_at", { ascending: false }).limit(50);
        if (values.kind) q = q.eq("kind", values.kind);
        if (values.query) q = q.or(`word.ilike.%${String(values.query).replace(/[,()]/g, " ")}%,body.ilike.%${String(values.query).replace(/[,()]/g, " ")}%`);
        const { data, error } = await q;
        if (error) return fail(error.message);
        const list = (data ?? []).map((r) => oneLine(toEntry(r, ctx.userId)));
        return { ok: true, message: list.length ? `${list.length} entries.` : "No entries yet.", data: list };
      },
    },
    Delete: {
      target: TARGET,
      run: async ({ ctx, target }) => {
        const { error, count } = await ctx.supabase.from("profile_entries").delete({ count: "exact" }).eq("id", target!).eq("owner_user_id", ctx.userId);
        if (error) return fail(error.message);
        return count ? { ok: true, message: "Deleted." } : fail("That's not one of your entries.");
      },
    },
    Share: {
      target: TARGET,
      params: [{ name: "visibility", type: "enum", options: ["public", "private"], required: true }],
      run: async ({ ctx, target, values }) => {
        const { error } = await ctx.supabase.from("profile_entries").update({ visibility: values.visibility }).eq("id", target!).eq("owner_user_id", ctx.userId);
        return error ? fail(error.message) : { ok: true, message: `Now ${values.visibility}.` };
      },
    },
  },
  actions: {
    Match: {
      description:
        "Find others' public entries that share words with the user's. idea: ideas. job: hiring meets looking. resource: have meets need. person: same relationship; romance only when both fit. The matches go on the page.",
      params: [
        { ...KIND_FIELD, required: true },
        { name: "query", type: "text", description: "Extra words to match on." },
        { name: "relationship", type: "enum", options: RELATIONSHIPS },
        { name: "place", type: "text" },
      ],
      run: async ({ ctx, values }) => {
        const { data, error } = await ctx.supabase.rpc("profile_matches", {
          p_kind: values.kind,
          p_query: values.query ?? "",
          p_relationship: values.relationship ?? "",
          p_place: values.place ?? "",
          p_limit: 30,
        });
        if (error) return fail(error.message);
        type M = { id: string; kind: string; side: string; word: string; body: string; place: string; people: string; owner_name: string; details: Record<string, string>; created_at: string; shared: string[] };
        const rows = (data ?? []) as M[];
        ctx.emit?.({
          type: "results",
          query: { word: `${values.kind} match`, body: String(values.query ?? ""), place: values.place as string | undefined },
          items: rows.map((r) => ({
            kind: r.kind,
            id: r.id,
            word: r.word,
            body: r.body,
            place: r.place || undefined,
            people: r.owner_name || undefined,
            visibility: "public",
            time: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            createdAt: r.created_at,
            shared: r.shared,
            details: detailsLine({ kind: r.kind as EntryKind, details: r.details ?? {} }),
          })),
        });
        return {
          ok: true,
          message: rows.length ? `${rows.length} matches are on the page.` : "No matches yet.",
          data: rows.slice(0, 8).map((r) => `${r.word} by ${r.owner_name || "a spark"}${r.shared?.length ? ` (shares: ${r.shared.slice(0, 5).join(", ")})` : ""}`),
        };
      },
    },
    Pause: {
      description: "Take an entry down for now, or put it back up (paused=false).",
      target: TARGET,
      params: [{ name: "paused", type: "enum", options: ["true", "false"], required: true }],
      run: async ({ ctx, target, values }) => {
        const paused = values.paused === "true";
        const { error } = await ctx.supabase.from("profile_entries").update({ paused }).eq("id", target!).eq("owner_user_id", ctx.userId);
        return error ? fail(error.message) : { ok: true, message: paused ? "Paused. It's down until you unpause." : "It's back up." };
      },
    },
    "Confirm Age": {
      description: "18+ check for romance. Ask for their birth date; only the yes is kept, never the date.",
      params: [{ name: "birth_date", type: "date", required: true }],
      run: async ({ ctx, values }) => {
        const [y, m, d] = String(values.birth_date).split("-").map(Number);
        const now = new Date();
        let age = now.getFullYear() - y;
        if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
        if (age < 18) return fail("Romance is for 18 and older.");
        const { error } = await ctx.supabase.from("adult_confirmations").upsert({ user_id: ctx.userId }, { onConflict: "user_id" });
        return error ? fail(error.message) : { ok: true, message: "Confirmed, 18+." };
      },
    },
    Hello: {
      description: "Send a private message about someone's entry (say hello), or answer in a thread on your own entry (asker = their user id from Messages).",
      target: TARGET,
      params: [
        { name: "body", type: "text", required: true, max: 2000 },
        { name: "asker", type: "text", description: "Only when answering on your own entry." },
      ],
      run: async ({ ctx, target, values }) => {
        const { error } = await ctx.supabase.rpc("say_hello", { p_entry: target, p_body: values.body, p_asker: values.asker ?? null });
        return error ? fail(error.message) : { ok: true, message: "Sent." };
      },
    },
    Messages: {
      description: "Private hello threads: on the user's entries, and the ones they started.",
      run: async ({ ctx }) => {
        const { data, error } = await ctx.supabase
          .from("profile_entry_messages")
          .select("entry_id, asker_user_id, sender_user_id, sender_name, body, created_at")
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) return fail(error.message);
        const lines = (data ?? []).map(
          (m) => `entry ${m.entry_id} · asker ${m.asker_user_id} · ${m.sender_user_id === ctx.userId ? "you" : m.sender_name || "a spark"}: ${m.body.slice(0, 200)}`,
        );
        return { ok: true, message: lines.length ? `${lines.length} messages.` : "No messages yet.", data: lines };
      },
    },
    Report: {
      description: "Report someone's entry. Three reports hide it until a moderator looks.",
      target: TARGET,
      params: [{ name: "reason", type: "text", max: 300 }],
      run: async ({ ctx, target, values }) => {
        const { error } = await ctx.supabase.from("profile_entry_reports").insert({ entry_id: target, reporter_user_id: ctx.userId, reason: values.reason ?? "" });
        if (error?.code === "23505") return { ok: true, message: "You already reported it." };
        return error ? fail(error.message) : { ok: true, message: "Reported. Thank you." };
      },
    },
    Block: {
      description: "Block the writer of an entry: neither sees or messages the other.",
      target: TARGET,
      run: async ({ ctx, target }) => {
        const { data: owner } = await ctx.supabase.rpc("entry_owner", { p_entry: target });
        if (!owner) return fail("That entry is gone.");
        if (owner === ctx.userId) return fail("That's your own entry.");
        const { error } = await ctx.supabase.from("user_blocks").upsert({ blocker_user_id: ctx.userId, blocked_user_id: owner }, { onConflict: "blocker_user_id,blocked_user_id" });
        return error ? fail(error.message) : { ok: true, message: "Blocked." };
      },
    },
  },
};

const ORG_KINDS = ["business", "government", "nonprofit", "other"] as const;
const ORG_FIELDS: Field[] = [
  { name: "kind", type: "enum", options: ORG_KINDS },
  { name: "body", type: "text", max: 5000, description: "Its definition: mission, announcements, contact, whatever they write." },
  { name: "place", type: "text", max: 60 },
  { name: "people", type: "text", max: 300 },
  { name: "visibility", type: "enum", options: ["public", "private"] },
  { name: "website", type: "text", max: 200 },
];

export const organizationNoun: NounDef = {
  name: "Organization",
  dictionary: "core",
  alwaysOn: true,
  description:
    "A business, government, nonprofit, or other group, defined in its own words. The body holds its mission, announcements, contact info. Anyone can make one (up to 3) and it shows right away; Official is a badge a moderator grants after Act Apply Official.",
  verbs: {
    Add: {
      params: [{ name: "name", type: "text", required: true, max: 80 }, ...ORG_FIELDS],
      run: async ({ ctx, values }) => {
        const { data, error } = await ctx.supabase.rpc("create_organization", {
          p_name: values.name,
          p_kind: values.kind ?? "other",
          p_website: values.website ?? "",
          p_about: values.body ?? "",
          p_place: values.place ?? "",
          p_people: values.people ?? "",
          p_visibility: values.visibility ?? "public",
        });
        return error ? fail(error.message) : { ok: true, message: `Made ${values.name}.`, data: { id: data } };
      },
    },
    Edit: {
      target: "the organization's id or name",
      params: [{ name: "name", type: "text", max: 80 }, ...ORG_FIELDS],
      run: async ({ ctx, target, values }) => {
        const org = await findMyOrg(ctx.supabase, ctx.userId, target!);
        if (!org) return fail("That's not one of your organizations.");
        const { error } = await ctx.supabase.rpc("save_organization", {
          p_id: org.id,
          p_name: values.name ?? org.name,
          p_kind: values.kind ?? org.kind,
          p_website: values.website ?? org.website,
          p_about: values.body ?? org.about,
          p_place: values.place ?? null,
          p_people: values.people ?? null,
          p_visibility: values.visibility ?? null,
        });
        return error ? fail(error.message) : { ok: true, message: "Saved." };
      },
    },
    Find: {
      description: "The user's organizations.",
      run: async ({ ctx }) => {
        const { data } = await ctx.supabase
          .from("organization_members")
          .select("organization:organizations(id, name, kind, status, neighborhood, about)")
          .eq("user_id", ctx.userId);
        const list = (data ?? [])
          .map((r) => (Array.isArray(r.organization) ? r.organization[0] : r.organization))
          .filter(Boolean)
          .map((o) => `${o!.id} · ${o!.name} · ${o!.kind} · ${o!.status}${o!.neighborhood ? ` · ${o!.neighborhood}` : ""}`);
        return { ok: true, message: list.length ? `${list.length} organizations.` : "None yet.", data: list };
      },
    },
    Delete: {
      target: "the organization's id or name",
      run: async ({ ctx, target }) => {
        const org = await findMyOrg(ctx.supabase, ctx.userId, target!);
        if (!org) return fail("That's not one of your organizations.");
        const { error } = await ctx.supabase.rpc("delete_organization", { p_id: org.id });
        return error ? fail(error.message) : { ok: true, message: `Deleted ${org.name}.` };
      },
    },
  },
  actions: {
    "Apply Official": {
      description: "Ask a moderator to check it's real and mark it Official.",
      target: "the organization's id or name",
      run: async ({ ctx, target }) => {
        const org = await findMyOrg(ctx.supabase, ctx.userId, target!);
        if (!org) return fail("That's not one of your organizations.");
        const { error } = await ctx.supabase.rpc("apply_official", { p_id: org.id });
        return error ? fail(error.message) : { ok: true, message: "Sent to a moderator." };
      },
    },
  },
};

type OrgRow = { id: string; name: string; kind: string; website: string; about: string };

async function findMyOrg(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string, target: string): Promise<OrgRow | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization:organizations(id, name, kind, website, about)")
    .eq("user_id", userId)
    .eq("role", "admin");
  const orgs = (data ?? []).map((r) => (Array.isArray(r.organization) ? r.organization[0] : r.organization)).filter(Boolean) as OrgRow[];
  const t = target.trim().toLowerCase();
  return orgs.find((o) => o.id === target.trim()) ?? orgs.find((o) => o.name.toLowerCase() === t) ?? orgs.find((o) => o.name.toLowerCase().includes(t)) ?? null;
}
