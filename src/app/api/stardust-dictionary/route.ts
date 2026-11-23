import { createClient } from "@/lib/supabase/server";
import { fetchDefinitions } from "@/lib/dictionary";

const PAGE_SIZE = 12;

const FILTERS = ["all", "noun", "verb", "organization", "person", "mine"] as const;
type Filter = (typeof FILTERS)[number];

type Entry = { id: string; term: string; body: string; partOfSpeech: string };

// The Stardust Dictionary, a page at a time, for the Dictionary popup.
// Filter by noun, verb, organization (businesses, governments, nonprofits,
// others), or person (sparks' public person entries). The words are open to
// everyone; organizations and people need a login.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const letter = (searchParams.get("letter") ?? "").trim().toUpperCase().slice(0, 1);
  const raw = searchParams.get("filter") ?? "all";
  const filter: Filter = (FILTERS as readonly string[]).includes(raw) ? (raw as Filter) : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let all: Entry[] = [];
  let note = "";

  if (filter === "mine" && !user) {
    note = "Log in to see your words.";
  } else if (filter === "mine") {
    all = await myWords(supabase, user!.id);
  } else if (filter === "all" || filter === "noun" || filter === "verb") {
    const { data: stardust } = await supabase.from("dictionaries").select("id").eq("address", "stardust").maybeSingle();
    if (stardust) {
      const pos = filter === "all" ? (["verb", "noun", "more"] as const) : ([filter] as const);
      const defs = await fetchDefinitions(supabase, { dictionaryIds: [stardust.id], partsOfSpeech: [...pos] });
      all = defs.map((d) => ({ id: d.id, term: d.term, body: d.body, partOfSpeech: d.partOfSpeech }));
    }
    // Everything you've written is in your dictionary too.
    if (filter === "all" && user) all = all.concat(await myWords(supabase, user.id));
  } else if (!user) {
    note = "Log in to see organizations and people.";
  } else if (filter === "organization") {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, kind, about, neighborhood, status")
      .eq("visibility", "public")
      .limit(1000);
    all = (data ?? []).map((o) => ({
      id: o.id,
      term: o.name,
      body: [o.about, o.neighborhood].filter(Boolean).join(" · "),
      partOfSpeech: `${o.kind}${o.status === "official" ? " · official" : ""}`,
    }));
  } else {
    // Romance entries never show here; they only show through a match.
    const { data } = await supabase
      .from("profile_entries")
      .select("id, owner_name, word, body, side, details")
      .eq("kind", "person")
      .eq("visibility", "public")
      .is("hidden_at", null)
      .eq("paused", false)
      .neq("details->>relationship", "romance")
      .limit(1000);
    all = (data ?? []).map((e) => ({
      id: e.id,
      term: e.owner_name || "A spark",
      body: [e.word, e.body].filter(Boolean).join(": "),
      partOfSpeech: String((e.details as Record<string, unknown> | null)?.relationship ?? "person"),
    }));
  }

  // "The Alien" files under A, as it does in the book.
  const sortKey = (term: string) => term.replace(/^the\s+/i, "");
  all.sort((a, b) => sortKey(a.term).localeCompare(sortKey(b.term)));

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A letter jumps to the page its first word is on.
  let current = Math.min(page, totalPages);
  if (letter) {
    const at = all.findIndex((d) => sortKey(d.term).toUpperCase().startsWith(letter));
    if (at >= 0) current = Math.floor(at / PAGE_SIZE) + 1;
  }
  const start = (current - 1) * PAGE_SIZE;

  return Response.json({ items: all.slice(start, start + PAGE_SIZE), page: current, totalPages, total, note });
}

// Every word the user has written: notes, journal entries, profile entries,
// and the organizations they run. The book's words live in the Stardust
// dictionary table; these live in their own tables, each with its own
// visibility, and show here for their writer.
async function myWords(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Entry[]> {
  const firstLine = (t: string) => {
    const line = (t ?? "").trim().split(/\r?\n/)[0];
    return line.length > 60 ? `${line.slice(0, 60)}...` : line;
  };
  const [notes, journals, entries, orgs] = await Promise.all([
    supabase.from("notes").select("id, body, visibility").eq("owner_user_id", userId).is("archived_at", null).limit(500),
    supabase.from("journal_entries").select("id, body, dictionary:dictionaries(name)").eq("owner_user_id", userId).limit(500),
    supabase.from("profile_entries").select("id, kind, word, body, visibility").eq("owner_user_id", userId).limit(200),
    supabase.from("organization_members").select("organization:organizations(id, name, kind, about)").eq("user_id", userId),
  ]);
  const out: Entry[] = [];
  for (const n of notes.data ?? []) out.push({ id: n.id, term: firstLine(n.body), body: n.body, partOfSpeech: `note · ${n.visibility}` });
  for (const j of journals.data ?? []) {
    const d = Array.isArray(j.dictionary) ? j.dictionary[0] : j.dictionary;
    out.push({ id: j.id, term: firstLine(j.body), body: j.body, partOfSpeech: `journal · ${d?.name ?? ""}` });
  }
  for (const e of entries.data ?? []) out.push({ id: e.id, term: e.word, body: e.body, partOfSpeech: `${e.kind} · ${e.visibility}` });
  for (const r of orgs.data ?? []) {
    const o = Array.isArray(r.organization) ? r.organization[0] : r.organization;
    if (o) out.push({ id: o.id, term: o.name, body: o.about ?? "", partOfSpeech: `organization · ${o.kind}` });
  }
  return out;
}
