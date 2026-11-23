"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// A new notebook: Notes or Journal, with your own name; shared makes it a group.
export async function createNotebook(style: "night" | "journal", name: string, shared = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in to make a notebook.");
  const { data, error } = await supabase.rpc("create_notebook", { p_style: style, p_name: name, p_shared: shared });
  if (error || !data) throw new Error(error?.message ?? "Couldn't make that notebook.");
  revalidatePath("/");
  return data as string;
}

export async function renameNotebook(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_notebook", { p_id: id, p_name: name });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function deleteNotebook(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_notebook", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
