import type { SupabaseClient } from "@supabase/supabase-js";

// Finds or creates the caller's personal instance of a template dictionary
// (e.g. their own Night DS notes dictionary) and opts them into it. Thin
// wrapper around the ensure_personal_instance() Postgres function.
export async function ensurePersonalInstance(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
  displayName: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_personal_instance", {
    p_template_id: templateId,
    p_owner_id: userId,
    p_display_name: displayName,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Couldn't set up your personal dictionary.");
  }

  return data as string;
}

// Looks up (without creating) the caller's existing instance of a template
// dictionary, if any.
export async function findPersonalInstance(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
): Promise<{ id: string; name: string; displayKind: string } | null> {
  const { data } = await supabase
    .from("dictionaries")
    .select("id, name, display_kind")
    .eq("template_id", templateId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, name: data.name, displayKind: data.display_kind };
}
