"use server";

import { createClient } from "@/lib/supabase/server";
import { fieldsOf, parseFields } from "@/lib/custom";
import { normalizeLabel } from "@/lib/dictionary-search";
import type { Listing, Maker } from "@/lib/listings";

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function cleanValues(raw: unknown): Record<string, string> {
  const values: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) values[k] = v.trim().slice(0, 5000);
    }
  }
  return values;
}

const labelList = (raw: string[] | string) =>
  (Array.isArray(raw) ? raw : raw.split(","))
    .map((l) => normalizeLabel(String(l)))
    .filter((l): l is string => Boolean(l))
    .slice(0, 10);

export async function createListing(searchId: string, name: string, values: Record<string, string>, labels: string[] | string = []) {
  const { supabase, user } = await signedIn();
  if (!user) throw new Error("Log in first.");
  const { data, error } = await supabase.rpc("create_listing", {
    p_search: searchId,
    p_name: name,
    p_values: cleanValues(values),
    p_labels: labelList(labels),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function saveListing(id: string, name: string, values: Record<string, string>) {
  const { supabase, user } = await signedIn();
  if (!user) throw new Error("Log in first.");
  const { error } = await supabase.rpc("save_listing", { p_id: id, p_name: name, p_values: cleanValues(values) });
  if (error) throw new Error(error.message);
}

export async function deleteListing(id: string) {
  const { supabase, user } = await signedIn();
  if (!user) throw new Error("Log in first.");
  const { error } = await supabase.rpc("delete_listing", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function getListing(id: string): Promise<Listing | null> {
  const { supabase, user } = await signedIn();
  const [{ data: d }, { data: labels }, { data: opted }] = await Promise.all([
    supabase.from("dictionaries").select("id, name, page, fields, by_name, created_at, owner_user_id").eq("id", id).maybeSingle(),
    supabase.from("dictionary_labels").select("label").eq("dictionary_id", id).order("label"),
    user
      ? supabase.from("user_dictionaries").select("dictionary_id").eq("dictionary_id", id).eq("opted_in", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!d) return null;
  return {
    id: d.id,
    name: d.name,
    values: (d.page ?? {}) as Record<string, string>,
    fields: fieldsOf(d.fields),
    labels: (labels ?? []).map((l) => l.label),
    byName: d.by_name || "A Stardust spark",
    createdAt: d.created_at,
    mine: Boolean(user && d.owner_user_id === user.id),
    optedIn: Boolean(opted),
  };
}

// Every dictionary that makes listings, for the type picker.
export async function listMakers(): Promise<Maker[]> {
  const { supabase } = await signedIn();
  const { data } = await supabase.from("dictionaries").select("id, name, noun, fields").not("noun", "is", null).order("name").limit(100);
  return (data ?? []).map((d) => ({ id: d.id, name: d.name, noun: d.noun as string, fields: fieldsOf(d.fields) }));
}

export async function createSearch(input: { name: string; description: string; noun: string; shape: string; imports: string }) {
  const { supabase, user } = await signedIn();
  if (!user) throw new Error("Log in first.");
  const fields = parseFields(input.shape);
  if ("error" in fields) throw new Error(fields.error);
  const { data, error } = await supabase.rpc("create_search", {
    p_name: input.name,
    p_description: input.description,
    p_noun: input.noun,
    p_fields: fields,
    p_imports: labelList(input.imports),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function setShape(id: string, noun: string, shape: string) {
  const { supabase, user } = await signedIn();
  if (!user) throw new Error("Log in first.");
  const fields = parseFields(shape);
  if ("error" in fields) throw new Error(fields.error);
  const { error } = await supabase.rpc("set_shape", { p_id: id, p_noun: noun, p_fields: fields });
  if (error) throw new Error(error.message);
}

// A word list: a built dictionary with a word and its definition.
export async function createWordList(name: string, description: string) {
  const { supabase, user } = await signedIn();
  if (!user) throw new Error("Log in first.");
  const { data, error } = await supabase.rpc("create_custom_dictionary", {
    p_name: name,
    p_description: description,
    p_fields: [
      { key: "word", label: "Word", type: "text" },
      { key: "definition", label: "Definition", type: "longtext" },
    ],
  });
  if (error) throw new Error(error.message);
  return data as string;
}
