"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePersonalInstance, findPersonalInstance } from "@/lib/personal-instance";
import { addDictionaryLabel, removeDictionaryLabel } from "@/lib/dictionary-labels";

export async function toggleDictionary(dictionaryId: string, optIn: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to change your dictionary collection.");
  }

  const { data: dictionary } = await supabase
    .from("dictionaries")
    .select("locked, kind, scope, owner_user_id")
    .eq("id", dictionaryId)
    .single();

  // A lock keeps your own always-on dictionaries on. Another spark's
  // Public Profile is yours to add or remove.
  const isOtherProfile = dictionary?.kind === "instance" && dictionary.owner_user_id !== user.id;

  if (dictionary?.locked && !isOtherProfile) {
    throw new Error("This dictionary is always on and can't be removed.");
  }

  // Instance-template dictionaries (e.g. Night DS) have no user_dictionaries
  // row of their own -- opting in resolves/creates the caller's own personal
  // instance and opts them into that instead.
  if (dictionary?.kind === "instance_template" && dictionary.scope === "group") {
    throw new Error("A group template makes a new group. Name the group first.");
  }

  if (dictionary?.kind === "instance_template") {
    if (optIn) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      await ensurePersonalInstance(supabase, user.id, dictionaryId, profile?.display_name ?? null);
    } else {
      const instance = await findPersonalInstance(supabase, user.id, dictionaryId);
      if (instance) {
        const { error } = await supabase
          .from("user_dictionaries")
          .upsert(
            { user_id: user.id, dictionary_id: instance.id, opted_in: false, opted_in_at: new Date().toISOString() },
            { onConflict: "user_id,dictionary_id" },
          );
        if (error) throw new Error(error.message);
      }
    }
    revalidatePath("/");
    return;
  }

  const { error } = await supabase
    .from("user_dictionaries")
    .upsert(
      { user_id: user.id, dictionary_id: dictionaryId, opted_in: optIn, opted_in_at: new Date().toISOString() },
      { onConflict: "user_id,dictionary_id" },
    );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function addLabel(dictionaryId: string, label: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in to label dictionaries.");

  const result = await addDictionaryLabel(supabase, dictionaryId, label);
  if (!result.ok) throw new Error(result.error);
  return result.label;
}

export async function removeLabel(dictionaryId: string, label: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in to label dictionaries.");

  const result = await removeDictionaryLabel(supabase, dictionaryId, label);
  if (!result.ok) throw new Error(result.error);
}

// Makes a new group from a group template (After School DS) and turns it on.
export async function createGroup(templateId: string, name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in to make a group.");

  const { data, error } = await supabase.rpc("create_group", { p_template_id: templateId, p_name: name });
  if (error || !data) throw new Error(error?.message ?? "Couldn't make that group.");

  revalidatePath("/");
  return data as string;
}
