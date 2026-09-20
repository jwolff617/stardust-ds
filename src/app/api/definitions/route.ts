import { createClient } from "@/lib/supabase/server";
import { fetchDefinitions, type PartOfSpeech } from "@/lib/dictionary";

const PAGE_SIZE = 20;
const VALID_POS: PartOfSpeech[] = ["verb", "noun", "more"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const dictionaryIds = (searchParams.get("dictionaryIds") ?? "")
    .split(",")
    .filter(Boolean);

  const partsOfSpeech = (searchParams.get("pos") ?? VALID_POS.join(","))
    .split(",")
    .filter((p): p is PartOfSpeech => VALID_POS.includes(p as PartOfSpeech));

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const supabase = await createClient();
  const all = await fetchDefinitions(supabase, { dictionaryIds, partsOfSpeech });

  const total = all.length;
  const start = (page - 1) * PAGE_SIZE;
  const items = all.slice(start, start + PAGE_SIZE);

  return Response.json({
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
