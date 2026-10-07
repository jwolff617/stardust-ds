"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePersonalInstance, findPersonalInstance } from "@/lib/personal-instance";

export async function toggleDictionary(dictionaryId: string, optIn: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to change your dictionary collection.");
  }

  const { data: dictionary } = await supabase
    .from("dictionaries")
    .select("locked, kind")
    .eq("id", dictionaryId)
    .single();

  if (dictionary?.locked) {
    throw new Error("This dictionary is always on and can't be removed.");
  }

  // Instance-template dictionaries (e.g. Night DS) have no user_dictionaries
  // row of their own -- opting in resolves/creates the caller's own personal
  // instance and opts them into that instead.
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
