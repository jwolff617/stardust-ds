import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLabel } from "@/lib/dictionary-search";
import { fieldsOf, type CustomField } from "@/lib/custom";
import { snippet, typeOf, type DictionaryType } from "@/lib/listings";

// Earned labels: only a moderator can give one (0033 enforces it).
export const RESERVED_LABELS = ["official", "verified", "government", "nonprofit"];

export type LabeledDictionary = {
  id: string;
  name: string;
  // The description, or for a listing its first words.
  summary: string;
  labels: string[];
  type: DictionaryType;
  byName: string;
  createdAt: string;
  official: boolean;
  mine: boolean;
  optedIn: boolean;
};

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
    if (RESERVED_LABELS.includes(label)) return { ok: false, error: `"${label}" is earned. A moderator gives it.` };
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

export type DictionaryLabelInfo = {
  labels: string[];
  shows: string[];
  canEdit: boolean;
  canEditShows: boolean;
  // What it makes, if anything: "idea" and the fields of one.
  noun: string | null;
  fields: CustomField[];
};

// One dictionary's labels, the labels it shows (its own, else its
// template's), and what the caller can change.
export async function loadDictionaryLabels(
  supabase: SupabaseClient,
  dictionaryId: string,
  userId: string | null,
): Promise<DictionaryLabelInfo> {
  const [{ data: d }, { data: rows }, { data: isModerator }] = await Promise.all([
    supabase.from("dictionaries").select("owner_user_id, template_id, shows, noun, fields, display_kind").eq("id", dictionaryId).maybeSingle(),
    supabase.from("dictionary_labels").select("label").eq("dictionary_id", dictionaryId).order("label"),
    userId ? supabase.rpc("is_moderator") : Promise.resolve({ data: false }),
  ]);
  let shows: string[] = d?.shows ?? [];
  if (shows.length === 0 && d?.template_id) {
    const { data: t } = await supabase.from("dictionaries").select("shows").eq("id", d.template_id).maybeSingle();
    shows = t?.shows ?? [];
  }
  const owns = Boolean(userId && d?.owner_user_id === userId);
  return {
    labels: (rows ?? []).map((r) => r.label),
    shows,
    canEdit: owns,
    canEditShows: d?.display_kind !== "listing" && (owns || Boolean(isModerator)),
    noun: d?.noun ?? null,
    fields: d?.noun ? fieldsOf(d.fields) : [],
  };
}

export async function saveShows(supabase: SupabaseClient, dictionaryId: string, labels: string[]): Promise<LabelResult | { ok: true }> {
  const clean = [...new Set(labels.map(normalizeLabel).filter((l): l is string => Boolean(l)))].slice(0, 10);
  const { error } = await supabase.rpc("set_shows", { p_id: dictionaryId, p_labels: clean });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export const IMPORTS_PER_PAGE = 12;

// One page of a dictionary's imports: the dictionaries carrying any of the
// labels that match the words, best match first. RLS decides what's visible.
export async function findLabeledDictionaries(
  supabase: SupabaseClient,
  labels: string[],
  userId: string | null,
  opts: { query?: string; exceptId?: string; page?: number; mine?: boolean } = {},
): Promise<{ items: LabeledDictionary[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const { data, error } = await supabase.rpc("search_imports", {
    p_labels: labels,
    p_query: (opts.query ?? "").slice(0, 200),
    p_except: opts.exceptId ?? null,
    p_limit: IMPORTS_PER_PAGE,
    p_offset: (page - 1) * IMPORTS_PER_PAGE,
    p_mine: Boolean(opts.mine && userId),
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; name: string; description: string | null; labels: string[]; owner_user_id: string | null; total: number }[];
  if (rows.length === 0) return { items: [], total: 0 };

  const ids = rows.map((r) => r.id);
  const [{ data: details }, { data: mine }] = await Promise.all([
    supabase.from("dictionaries").select("id, display_kind, noun, page, fields, by_name, created_at, page_status").in("id", ids),
    userId
      ? supabase.from("user_dictionaries").select("dictionary_id").eq("opted_in", true).in("dictionary_id", ids)
      : Promise.resolve({ data: [] as { dictionary_id: string }[] }),
  ]);
  const byId = new Map((details ?? []).map((d) => [d.id, d]));
  const optedIn = new Set((mine ?? []).map((m) => m.dictionary_id));
  return {
    total: Number(rows[0].total),
    items: rows.map((r) => {
      const d = byId.get(r.id);
      const type = typeOf(d?.display_kind ?? "", d?.noun);
      const values = (d?.page ?? {}) as Record<string, string>;
      return {
        id: r.id,
        name: r.name,
        summary: type === "Listing" ? snippet(fieldsOf(d?.fields), values) : r.description ?? "",
        labels: r.labels ?? [],
        type,
        byName: d?.by_name ?? "",
        createdAt: d?.created_at ?? "",
        official: d?.page_status === "official",
        mine: Boolean(userId && r.owner_user_id === userId),
        optedIn: optedIn.has(r.id),
      };
    }),
  };
}
