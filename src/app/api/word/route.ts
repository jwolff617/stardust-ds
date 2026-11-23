import { createClient } from "@/lib/supabase/server";

const ID = /^[0-9a-f-]{36}$/i;
const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

// One word by what it is and its id, to open on the page. Each table's own
// read rules decide whether the caller may see it.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "";
  const id = searchParams.get("id") ?? "";
  if (!ID.test(id)) return Response.json({ error: "No such word." }, { status: 400 });
  const supabase = await createClient();
  const none = Response.json({ error: "That word isn't there anymore." }, { status: 404 });

  if (kind === "note") {
    const { data } = await supabase.from("notes").select("body, place, people, visibility, time_frame, created_at").eq("id", id).maybeSingle();
    if (!data) return none;
    const word = data.body.trim().split(/\r?\n/)[0].slice(0, 60);
    return Response.json({ kind, id, word, body: data.body, place: data.place, people: data.people, time: data.time_frame, visibility: data.visibility });
  }
  if (kind === "journal") {
    const { data } = await supabase.from("journal_entries").select("body, place, people, created_at, dictionary:dictionaries(name, scope)").eq("id", id).maybeSingle();
    if (!data) return none;
    const d = Array.isArray(data.dictionary) ? data.dictionary[0] : data.dictionary;
    return Response.json({
      kind, id, word: d?.name ?? "Journal", body: data.body, place: data.place, people: data.people,
      time: fmt(data.created_at), visibility: d?.scope === "group" ? "group" : d?.scope === "shared" ? "public" : "private",
    });
  }
  if (["person", "idea", "job", "resource"].includes(kind)) {
    const { data } = await supabase.from("profile_entries").select("word, body, place, people, visibility, created_at").eq("id", id).maybeSingle();
    if (!data) return none;
    return Response.json({ kind, id, word: data.word, body: data.body, place: data.place, people: data.people, time: fmt(data.created_at), visibility: data.visibility });
  }
  if (kind === "organization") {
    const { data } = await supabase.from("organizations").select("name, about, neighborhood, people, visibility, created_at").eq("id", id).maybeSingle();
    if (!data) return none;
    return Response.json({ kind, id, word: data.name, body: data.about, place: data.neighborhood, people: data.people, time: fmt(data.created_at), visibility: data.visibility });
  }
  if (["noun", "verb", "word"].includes(kind)) {
    const { data } = await supabase.from("definitions").select("body, part_of_speech, term:terms(name)").eq("id", id).maybeSingle();
    if (!data) return none;
    const t = Array.isArray(data.term) ? data.term[0] : data.term;
    return Response.json({ kind: data.part_of_speech === "verb" ? "verb" : "noun", id, word: t?.name ?? "", body: data.body, visibility: "public" });
  }
  return Response.json({ error: "No such word." }, { status: 400 });
}
