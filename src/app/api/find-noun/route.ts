import { createClient } from "@/lib/supabase/server";
import { myNouns } from "@/lib/shortcuts";
import type { FoundWord } from "@/lib/sage-ui";

// Finds a noun by name for My List: everything the spark owns, plus public
// orgs and ideas. Not the Stardust Dictionary (that's for reading).
// Returns the exact match when there is one, else the closest names.
const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
// "Peacemaker's Notes" also answers to "Notes".
const short = (name: string) => name.replace(/^.{1,40}?['’]s\s+/, "") || name;

export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("name") ?? "").trim().slice(0, 120);
  if (!name) return Response.json({ exact: null, items: [] });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ exact: null, items: [] }, { status: 401 });

  const want = norm(name);
  const like = `%${name.replace(/[%_]/g, "")}%`;

  const [mine, { data: orgs }, { data: ideas }, { data: entries }, { data: found }] = await Promise.all([
    myNouns(supabase, user.id, {}).catch(() => []),
    supabase.from("organizations").select("id, name, about").ilike("name", like).limit(20),
    supabase.from("dictionaries").select("id, name").like("address", "idea-%").eq("status", "approved").ilike("name", like).limit(20),
    supabase.from("profile_entries").select("id, kind, word, body").eq("owner_user_id", user.id).ilike("word", like).limit(20),
    // Everything else in Supabase you can see (notes, journal entries, groups...), by name.
    supabase.rpc("stardust_search", { p_word: name, p_limit: 60 }),
  ]);

  const pool: FoundWord[] = [
    ...mine.map((n) => ({ kind: n.kind, id: n.id, word: n.word, body: "", details: n.thing })),
    ...(entries ?? []).map((e) => ({ kind: e.kind, id: e.id, word: e.word, body: e.body ?? "", details: `${e.kind} profile` })),
    ...(orgs ?? []).map((o) => ({ kind: "organization", id: o.id, word: o.name, body: o.about ?? "", details: "org" })),
    ...(ideas ?? []).map((d) => ({ kind: "notebook", id: d.id, word: d.name, body: "", details: "idea" })),
    // Not the Stardust Dictionary: people read that in the Dictionary.
    ...((found ?? []) as { kind: string; id: string; word: string; body: string }[])
      .filter((f) => !["noun", "verb", "word"].includes(f.kind))
      .map((f) => ({ kind: f.kind, id: f.id, word: f.word, body: f.body ?? "", details: f.kind })),
  ];
  const seen = new Set<string>();
  const items = pool.filter((p) => {
    const k = `${p.kind}:${p.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const names = (w: string) => [norm(w), norm(short(w))];
  const exact = items.find((i) => names(i.word).includes(want)) ?? null;
  const close = items
    .filter((i) => names(i.word).some((n) => n.includes(want) || want.includes(n)))
    .slice(0, 20);
  return Response.json({ exact, items: close });
}
