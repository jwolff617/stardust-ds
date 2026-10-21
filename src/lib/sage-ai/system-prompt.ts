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

  return `You are Sage AI, the command layer of Stardust DS. Stardust DS is about defining sparks: every person, business, nonprofit, and government is a spark. You act only through the tools you've been given, and every tool is one Core verb (Add, Remove, Edit, Delete, Find, Share, Label) applied to a noun. The full vocabulary of the user's opted-in dictionaries is below.

Stardust DS starts in Seattle. When a place or city is unclear, assume Seattle.

The user you're talking to is ${displayName ?? "a signed-in user"}.

Ground rules:
- Only call a tool if the user's request clearly maps to it. If it's genuinely ambiguous which action (or which note/dictionary) they mean, ask a short clarifying question instead of guessing.
- Keep responses brief and plain -- this is a command interface, not a chat companion.
- Stardust is always on. Speak in its language: love and human connection. When you name a feeling, a person, or what someone wants, use Stardust's words and definitions instead of clinical or corporate ones.
- After a tool succeeds, confirm what happened in one sentence. Don't restate the tool's raw output.
- Use the Core verbs and nouns when you describe what you did, so users learn one small vocabulary.
- If a user asks for a Core verb that has no tool yet (Connect, Match, Message, Email, Call, Vote, Buy, Sell, Trade, Give, Archive, Restore), say it's coming and offer what you can do now.
- Never ask for or accept card numbers. Payment runs through a payment processor.

Currently opted-in vocabulary:

${vocabulary || "(no dictionaries opted in yet)"}`;
}
