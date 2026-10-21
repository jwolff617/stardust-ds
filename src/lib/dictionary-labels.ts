import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLabel } from "@/lib/dictionary-search";

export type LabelResult = { ok: true; label: string } | { ok: false; error: string };

// RLS only lets the dictionary's owner write its labels, so this needs no
// ownership check of its own.
export async function addDictionaryLabel(
  supabase: SupabaseClient,
  dictionaryId: string,
  rawLabel: string,
): Promise<LabelResult> {
  const label = normalizeLabel(rawLabel);
  if (!label) return { ok: false, error: "A label is 1 to 40 characters." };

  const { error } = await supabase
    .from("dictionary_labels")
    .upsert({ dictionary_id: dictionaryId, label }, { onConflict: "dictionary_id,label", ignoreDuplicates: true });
  if (error) return { ok: false, error: "You can only label dictionaries you own." };

  return { ok: true, label };
}

export async function removeDictionaryLabel(
  supabase: SupabaseClient,
  dictionaryId: string,
  rawLabel: string,
): Promise<LabelResult> {
  const label = normalizeLabel(rawLabel);
  if (!label) return { ok: false, error: "A label is 1 to 40 characters." };

  const { error } = await supabase
    .from("dictionary_labels")
    .delete()
    .eq("dictionary_id", dictionaryId)
    .eq("label", label);
  if (error) return { ok: false, error: error.message };

  return { ok: true, label };
}
