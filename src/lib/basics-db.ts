import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanRecord, type BasicApp, type BasicRecord } from "./basics";

// Basic app reads and writes, shared by the Display View's API route and
// Sage AI. RLS keeps every record to its owner's own copy.

function toRecord(app: BasicApp, row: Record<string, unknown>): BasicRecord {
  const record: BasicRecord = { id: String(row.id), updatedAt: String(row.updated_at) };
  for (const f of app.fields) record[f.key] = (row[f.key] ?? null) as string | number | null;
  return record;
}

const columns = (app: BasicApp) => ["id", "updated_at", ...app.fields.map((f) => f.key)].join(", ");

// Every record in the copy, in the app's order. `query` keeps records with
// that text in any text field.
export async function listRecords(
  supabase: SupabaseClient,
  app: BasicApp,
  dictionaryId: string,
  query?: string,
): Promise<BasicRecord[]> {
  const { data, error } = await supabase.from(app.table).select(columns(app)).eq("dictionary_id", dictionaryId).limit(2000);
  if (error) throw new Error(error.message);
  let records = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => toRecord(app, r));
  const q = query?.trim().toLowerCase();
  if (q) {
    const textKeys = app.fields.filter((f) => f.type !== "integer").map((f) => f.key);
    records = records.filter((r) => textKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
  }
  return records.sort(app.sort);
}

export async function addRecord(
  supabase: SupabaseClient,
  app: BasicApp,
  dictionaryId: string,
  userId: string,
  input: Record<string, unknown>,
): Promise<BasicRecord> {
  const cleaned = cleanRecord(app, input);
  if ("error" in cleaned) throw new Error(cleaned.error);
  const { data, error } = await supabase
    .from(app.table)
    .insert({ ...cleaned.row, dictionary_id: dictionaryId, owner_user_id: userId })
    .select(columns(app))
    .single();
  if (error) throw new Error(error.message);
  return toRecord(app, data as unknown as Record<string, unknown>);
}

// Changes only the fields given; the rest keep their values.
export async function editRecord(
  supabase: SupabaseClient,
  app: BasicApp,
  dictionaryId: string,
  id: string,
  changes: Record<string, unknown>,
): Promise<BasicRecord> {
  const { data: current, error: findError } = await supabase
    .from(app.table)
    .select(columns(app))
    .eq("dictionary_id", dictionaryId)
    .eq("id", id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!current) throw new Error(`No ${app.noun.toLowerCase()} with id ${id}.`);

  const known = Object.fromEntries(Object.entries(changes).filter(([k]) => app.fields.some((f) => f.key === k)));
  const cleaned = cleanRecord(app, { ...(current as unknown as Record<string, unknown>), ...known });
  if ("error" in cleaned) throw new Error(cleaned.error);

  const { data, error } = await supabase
    .from(app.table)
    .update({ ...cleaned.row, updated_at: new Date().toISOString() })
    .eq("dictionary_id", dictionaryId)
    .eq("id", id)
    .select(columns(app))
    .single();
  if (error) throw new Error(error.message);
  return toRecord(app, data as unknown as Record<string, unknown>);
}

export async function deleteRecord(supabase: SupabaseClient, app: BasicApp, dictionaryId: string, id: string): Promise<void> {
  const { data, error } = await supabase.from(app.table).delete().eq("dictionary_id", dictionaryId).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`No ${app.noun.toLowerCase()} with id ${id}.`);
}
