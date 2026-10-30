import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanLabels } from "./posts";
import { cleanValues, fieldsOf, parseFields, type CustomEntry, type CustomField } from "./custom";

// Reads and writes for dictionaries people build (0028). Shared by the API
// route and Sage AI, so both follow the same rules.

export type Result = { ok: true; id?: string } | { ok: false; error: string };

export async function createCustomDictionary(supabase: SupabaseClient, name: string, description: string, fieldsInput: unknown): Promise<Result> {
  const fields = parseFields(fieldsInput);
  if ("error" in fields) return { ok: false, error: fields.error };
  const { data, error } = await supabase.rpc("create_custom_dictionary", { p_name: name, p_description: description, p_fields: fields });
  return error ? { ok: false, error: error.message } : { ok: true, id: data as string };
}

export async function deleteCustomDictionary(supabase: SupabaseClient, dictionaryId: string): Promise<Result> {
  const { error } = await supabase.rpc("delete_custom_dictionary", { p_dictionary_id: dictionaryId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function loadFields(supabase: SupabaseClient, dictionaryId: string): Promise<CustomField[] | null> {
  const { data } = await supabase.from("dictionaries").select("fields, display_kind").eq("id", dictionaryId).maybeSingle();
  return data && data.display_kind === "custom" ? fieldsOf(data.fields) : null;
}

export async function loadEntries(supabase: SupabaseClient, dictionaryId: string, q = ""): Promise<CustomEntry[]> {
  const { data, error } = await supabase
    .from("custom_entries")
    .select("id, data, labels, created_at")
    .eq("dictionary_id", dictionaryId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const want = q.trim().toLowerCase();
  return (data ?? [])
    .map((r) => ({ id: r.id, values: (r.data ?? {}) as Record<string, string>, labels: r.labels ?? [], createdAt: r.created_at }))
    .filter((e) => !want || [...Object.values(e.values), ...e.labels].join(" ").toLowerCase().includes(want));
}

export async function saveEntry(
  supabase: SupabaseClient,
  dictionaryId: string,
  input: { values: unknown; labels?: unknown },
  id?: string,
): Promise<Result> {
  const fields = await loadFields(supabase, dictionaryId);
  if (!fields) return { ok: false, error: "That isn't a dictionary you built." };
  const values = cleanValues(fields, input.values);
  if ("error" in values) return { ok: false, error: values.error };
  const row = { data: values, labels: cleanLabels(input.labels ?? []), updated_at: new Date().toISOString() };
  if (id) {
    const { error } = await supabase.from("custom_entries").update(row).eq("id", id).eq("dictionary_id", dictionaryId);
    return error ? { ok: false, error: error.message } : { ok: true, id };
  }
  const { data, error } = await supabase.from("custom_entries").insert({ ...row, dictionary_id: dictionaryId }).select("id").single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

export async function deleteEntry(supabase: SupabaseClient, dictionaryId: string, id: string): Promise<Result> {
  const { error } = await supabase.from("custom_entries").delete().eq("id", id).eq("dictionary_id", dictionaryId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
