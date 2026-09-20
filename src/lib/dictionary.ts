import type { SupabaseClient } from "@supabase/supabase-js";

export type PartOfSpeech = "verb" | "noun" | "more";

export type NormalizedDefinition = {
  id: string;
  term: string;
  body: string;
  partOfSpeech: PartOfSpeech;
  dictionaryId: string;
  dictionaryName: string;
};

// Term View data: the word/definition vocabulary a dictionary defines.
// A personal instance (e.g. a user's own Night DS notes dictionary) has no
// definitions of its own -- its Term View shows its template's shared
// vocabulary, attributed back to the instance's own id/name.
export async function fetchDefinitions(
  supabase: SupabaseClient,
  {
    dictionaryIds,
    partsOfSpeech,
  }: {
    dictionaryIds: string[];
    partsOfSpeech: PartOfSpeech[];
  },
): Promise<NormalizedDefinition[]> {
  if (dictionaryIds.length === 0 || partsOfSpeech.length === 0) return [];

  const { data: dictionaries } = await supabase
    .from("dictionaries")
    .select("id, name, scope, template_id")
    .in("id", dictionaryIds);

  const sharedIds: string[] = [];
  // Maps the shared dictionary_id actually queried against `definitions`
  // back to the originally-requested dictionary's own id/name.
  const displayFor = new Map<string, { id: string; name: string }>();

  for (const d of dictionaries ?? []) {
    if (d.scope === "shared") {
      sharedIds.push(d.id);
      displayFor.set(d.id, { id: d.id, name: d.name });
    } else if (d.template_id) {
      sharedIds.push(d.template_id);
      displayFor.set(d.template_id, { id: d.id, name: d.name });
    }
  }

  if (sharedIds.length === 0) return [];

  const { data } = await supabase
    .from("definitions")
    .select("id, body, part_of_speech, dictionary_id, term:terms(name)")
    .in("dictionary_id", sharedIds)
    .in("part_of_speech", partsOfSpeech);

  const results: NormalizedDefinition[] = [];
  for (const row of data ?? []) {
    const term = Array.isArray(row.term) ? row.term[0] : row.term;
    const display = displayFor.get(row.dictionary_id);
    if (!display) continue;
    results.push({
      id: row.id,
      term: term?.name ?? "",
      body: row.body,
      partOfSpeech: row.part_of_speech as PartOfSpeech,
      dictionaryId: display.id,
      dictionaryName: display.name,
    });
  }

  results.sort((a, b) => a.term.localeCompare(b.term));
  return results;
}

export type OptedInDictionary = {
  id: string;
  address: string;
  name: string;
  scope: "shared" | "personal";
  locked: boolean;
};

// The signed-in user's currently opted-in dictionaries -- the vocabulary
// Sage AI is allowed to act within, and the set Module 2 defaults to.
// Instance-template dictionaries never appear here directly; a user's own
// resolved instance does, once they've opted in.
export async function getOptedInDictionaries(
  supabase: SupabaseClient,
): Promise<OptedInDictionary[]> {
  const { data } = await supabase
    .from("user_dictionaries")
    .select("opted_in, dictionary:dictionaries(id, address, name, scope, locked)")
    .eq("opted_in", true);

  return (data ?? [])
    .map((row) => (Array.isArray(row.dictionary) ? row.dictionary[0] : row.dictionary))
    .filter((d): d is OptedInDictionary => Boolean(d));
}
