import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLabel } from "@/lib/dictionary-search";

// Earned labels: only a moderator can give one (0033 enforces it).
export const RESERVED_LABELS = ["official", "verified", "government", "nonprofit"];

// The labels that put a dictionary into a board, every spelling people use.
export const BOARD_LABELS: Record<string, string[]> = {
  "idea-index-ds": ["idea index", "idea-index", "ideaindex", "ideas"],
};

export type LabeledDictionary = { id: string; name: string; description: string | null; labels: string[]; mine: boolean; optedIn: boolean };

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
  if (error) {
    if (RESERVED_LABELS.includes(label)) return { ok: false, error: `#${label} is earned. A moderator gives it.` };
    return { ok: false, error: "You can only label dictionaries you own." };
  }

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

// One dictionary's labels, and whether the caller can change them.
export async function loadDictionaryLabels(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string | null,
): Promise<{ labels: string[]; canEdit: boolean }> {
  const [{ data: d }, { data: rows }] = await Promise.all([
    supabase.from("dictionaries").select("owner_user_id").eq("id", dictionaryId).maybeSingle(),
    supabase.from("dictionary_labels").select("label").eq("dictionary_id", dictionaryId).order("label"),
  ]);
  return {
    labels: (rows ?? []).map((r) => r.label),
    canEdit: Boolean(userId && d?.owner_user_id === userId),
  };
}

// Every dictionary the caller can see that carries one of these labels.
// RLS decides what's visible: official pages, public profiles, shared
// dictionaries, and the caller's own.
export async function findLabeledDictionaries(
  supabase: SupabaseClient,
  labels: string[],
  userId: string | null,
): Promise<LabeledDictionary[]> {
  const { data: hits } = await supabase.from("dictionary_labels").select("dictionary_id").in("label", labels);
  const ids = [...new Set((hits ?? []).map((h) => h.dictionary_id))];
  if (ids.length === 0) return [];

  const [{ data: rows }, { data: allLabels }, { data: mine }] = await Promise.all([
    supabase.from("dictionaries").select("id, name, description, owner_user_id").in("id", ids).order("name"),
    supabase.from("dictionary_labels").select("dictionary_id, label").in("dictionary_id", ids).order("label"),
    userId
      ? supabase.from("user_dictionaries").select("dictionary_id").eq("opted_in", true).in("dictionary_id", ids)
      : Promise.resolve({ data: [] as { dictionary_id: string }[] }),
  ]);
  const optedIn = new Set((mine ?? []).map((m) => m.dictionary_id));
  return (rows ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    labels: (allLabels ?? []).filter((l) => l.dictionary_id === d.id).map((l) => l.label),
    mine: Boolean(userId && d.owner_user_id === userId),
    optedIn: optedIn.has(d.id),
  }));
}
