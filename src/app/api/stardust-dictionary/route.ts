import { createClient } from "@/lib/supabase/server";
import { fetchDefinitions } from "@/lib/dictionary";

const PAGE_SIZE = 12;

// The Stardust Dictionary, a page at a time, for the Dictionary popup.
// Anyone can read it, signed in or not.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const letter = (searchParams.get("letter") ?? "").trim().toUpperCase().slice(0, 1);

  const supabase = await createClient();
  const { data: stardust } = await supabase.from("dictionaries").select("id").eq("address", "stardust").maybeSingle();
  if (!stardust) return Response.json({ items: [], page: 1, totalPages: 1, total: 0 });

  const all = await fetchDefinitions(supabase, { dictionaryIds: [stardust.id], partsOfSpeech: ["verb", "noun", "more"] });
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

  return Response.json({
    items: all.slice(start, start + PAGE_SIZE).map((d) => ({ id: d.id, term: d.term, body: d.body, partOfSpeech: d.partOfSpeech })),
    page: current,
    totalPages,
    total,
  });
}
