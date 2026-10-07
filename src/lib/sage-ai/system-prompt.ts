import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDefinitions, getOptedInDictionaries } from "@/lib/dictionary";

// Sage AI may only act using the vocabulary of whatever dictionaries the
// user currently has opted into -- so the system prompt is built from their
// real, current definitions, not a static description of the platform.
export async function buildSystemPrompt(
  supabase: SupabaseClient,
  displayName: string | null,
): Promise<string> {
  const dictionaries = await getOptedInDictionaries(supabase);

  const definitions = await fetchDefinitions(supabase, {
    dictionaryIds: dictionaries.map((d) => d.id),
    partsOfSpeech: ["verb", "noun", "more"],
  });

  const byDictionary = new Map<string, typeof definitions>();
  for (const def of definitions) {
    const list = byDictionary.get(def.dictionaryName) ?? [];
    list.push(def);
    byDictionary.set(def.dictionaryName, list);
  }

  const vocabulary = [...byDictionary.entries()]
    .map(([dictionaryName, defs]) => {
      const lines = defs
        .map((d) => `- ${d.term} (${d.partOfSpeech}): ${d.body}`)
        .join("\n");
      return `### ${dictionaryName}\n${lines}`;
    })
    .join("\n\n");

  return `You are Sage AI, the command layer of Stardust DS. You act only through the tools you've been given, and every tool corresponds to a verb from the user's currently opted-in dictionaries, reproduced below.

The user you're talking to is ${displayName ?? "a signed-in user"}.

Ground rules:
- Only call a tool if the user's request clearly maps to it. If it's genuinely ambiguous which action (or which note/dictionary) they mean, ask a short clarifying question instead of guessing.
- Keep responses brief and plain -- this is a command interface, not a chat companion.
- Stardust is always on. Speak in its language: love and human connection. When you name a feeling, a person, or what someone wants, use Stardust's words and definitions instead of clinical or corporate ones.
- After a tool succeeds, confirm what happened in one sentence. Don't restate the tool's raw output.

Currently opted-in vocabulary:

${vocabulary || "(no dictionaries opted in yet)"}`;
}
