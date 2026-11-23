import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoundWord, UiDirective } from "@/lib/sage-ui";

// The shortcut box. Numbers 1 to 50 are each spark's own hotkeys (resolved
// in the Sage AI route). Letters are built in. Longer codes are tickers a
// moderator assigns to an organization (0055).

export const LETTERS: Record<string, { label: string; thing?: string; panel?: "profile" | "settings" | "inbox"; section?: string }> = {
  j: { label: "journals", thing: "journal" },
  n: { label: "notes", thing: "notes" },
  i: { label: "ideas", thing: "idea" },
  o: { label: "orgs", thing: "org" },
  g: { label: "groups", thing: "group" },
  r: { label: "resources", thing: "resource" },
  w: { label: "your nouns", thing: "noun" },
  p: { label: "profile", panel: "profile" },
  s: { label: "settings", panel: "settings" },
  m: { label: "inbox", panel: "inbox" },
  pp: { label: "person profile", panel: "profile", section: "person" },
  pi: { label: "idea profile", panel: "profile", section: "idea" },
  pj: { label: "job profile", panel: "profile", section: "job" },
  pr: { label: "resource profile", panel: "profile", section: "resource" },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Everything of one thing the user has, newest first, as results to click.
export async function listMine(supabase: SupabaseClient, userId: string, thing: string): Promise<FoundWord[]> {
  if (thing === "journal" || thing === "notes" || thing === "idea" || thing === "group") {
    let q = supabase
      .from("user_dictionaries")
      .select("dictionary:dictionaries!inner(id, name, address, scope, display_kind, status, created_at)")
      .eq("user_id", userId)
      .eq("opted_in", true)
      .eq("dictionaries.status", "approved");
    if (thing === "idea") q = q.like("dictionaries.address", "idea-%");
    else if (thing === "group") q = q.eq("dictionaries.scope", "group");
    else {
      q = q
        .eq("dictionaries.display_kind", thing === "notes" ? "notes_list" : "journal")
        .neq("dictionaries.scope", "group")
        .not("dictionaries.address", "like", "idea-%");
    }
    const { data } = await q;
    type D = { id: string; name: string; address: string; created_at: string };
    return (data ?? [])
      .map((r) => (Array.isArray(r.dictionary) ? r.dictionary[0] : r.dictionary) as D | null)
      .filter((d): d is D => Boolean(d))
      // Bet Stories is everyone's public journal, not one of "your journals".
      .filter((d) => thing !== "journal" || d.address !== "bet-stories")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((d) => ({ kind: "notebook", id: d.id, word: d.name, body: "", time: fmt(d.created_at), createdAt: d.created_at }));
  }
  if (thing === "org") {
    const { data } = await supabase.from("organization_members").select("organization:organizations(id, name, kind, about, created_at)").eq("user_id", userId);
    type O = { id: string; name: string; kind: string; about: string; created_at: string };
    return (data ?? [])
      .map((r) => (Array.isArray(r.organization) ? r.organization[0] : r.organization) as O | null)
      .filter((o): o is O => Boolean(o))
      .map((o) => ({ kind: "organization", id: o.id, word: o.name, body: o.about ?? "", details: o.kind, time: fmt(o.created_at), createdAt: o.created_at }));
  }
  if (thing === "resource") {
    const { data } = await supabase.from("profile_entries").select("id, word, body, place, side, created_at").eq("owner_user_id", userId).eq("kind", "resource").order("created_at", { ascending: false });
    return (data ?? []).map((e) => ({ kind: "resource", id: e.id, word: e.word, body: e.body, place: e.place || undefined, details: e.side === "seek" ? "need" : "have", time: fmt(e.created_at), createdAt: e.created_at }));
  }
  if (thing === "noun") {
    const { data } = await supabase.from("my_words").select("id, word, body, place, created_at").eq("owner_user_id", userId).order("word");
    return (data ?? []).map((w) => ({ kind: "mine", id: w.id, word: w.word, body: w.body, place: w.place || undefined, time: fmt(w.created_at), createdAt: w.created_at }));
  }
  return [];
}

// What a letter code or ticker opens. Null when it's neither.
export async function resolveCode(supabase: SupabaseClient, userId: string, code: string): Promise<{ go: UiDirective; label: string } | { missing: string } | null> {
  const c = code.toLowerCase();
  const letter = LETTERS[c];
  if (letter) {
    if (letter.panel) return { go: { type: "panel", panel: letter.panel, ...(letter.section ? { section: letter.section } : {}) }, label: letter.label };
    const items = await listMine(supabase, userId, letter.thing!);
    return { go: { type: "results", query: { word: "" }, items, title: `Your ${letter.label}`, thing: letter.thing }, label: letter.label };
  }
  if (/^[a-z][a-z0-9]{1,4}$/.test(c)) {
    const { data } = await supabase.from("tickers").select("organization_id").eq("code", c).maybeSingle();
    if (data) return { go: { type: "open", kind: "organization", id: data.organization_id }, label: c };
    return { missing: `#${c} isn't anything yet.` };
  }
  return null;
}
