import type { SupabaseClient } from "@supabase/supabase-js";
import { kindOf, postText, type BoardConfig } from "./boards";
import { cleanPost, PHOTO_BUCKET } from "./posts";
import { checkWording } from "./wording";

// Writing posts, shared by the Posts API and Sage AI so both run the same
// checks. Every call runs as the signed-in spark, under RLS.

export type Result = { ok: true; id?: string } | { ok: false; error: string; status?: number };

type Owned = { id: string; author_user_id: string; kind: string; photos: string[] | null; status: string; title: string };

async function ownPost(supabase: SupabaseClient, userId: string, dictionaryId: string, id: string): Promise<Owned | null> {
  const { data } = await supabase
    .from("posts")
    .select("id, author_user_id, kind, photos, status, title")
    .eq("id", id)
    .eq("dictionary_id", dictionaryId)
    .maybeSingle();
  return data && data.author_user_id === userId ? (data as Owned) : null;
}

async function removePhotos(supabase: SupabaseClient, paths: string[]) {
  if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
}

// Adds or edits a post. With strict on (Sage AI), a wording issue is an
// error to fix; the form shows it to the person instead and lets them decide.
export async function savePost(
  supabase: SupabaseClient,
  userId: string,
  config: BoardConfig,
  dictionaryId: string,
  input: Record<string, unknown>,
  opts: { id?: string; strict?: boolean } = {},
): Promise<Result> {
  const cleaned = cleanPost(config, input, userId);
  if ("error" in cleaned) return { ok: false, error: cleaned.error };
  const post = cleaned.post;

  if (opts.strict) {
    const kind = kindOf(config, post.kind);
    const issues = kind?.check ? checkWording(kind.check, postText(post)) : [];
    if (issues.length > 0) {
      return { ok: false, error: `Reword this first. ${issues.map((i) => `"${i.phrase}": ${i.why}`).join(" ")}` };
    }
  }

  if (!opts.id) {
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...post, dictionary_id: dictionaryId, author_user_id: userId })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  }

  const before = await ownPost(supabase, userId, dictionaryId, opts.id);
  if (!before) return { ok: false, error: "That post isn't yours to edit.", status: 403 };
  const { error } = await supabase.from("posts").update(post).eq("id", opts.id).eq("author_user_id", userId);
  if (error) return { ok: false, error: error.message };
  await removePhotos(supabase, (before.photos ?? []).filter((p) => !post.photos.includes(p)));
  return { ok: true, id: opts.id };
}

// Closes a post (sold, given, filled). A note, if given, goes to everyone
// who wrote, so nobody is left waiting.
export async function closePost(supabase: SupabaseClient, userId: string, dictionaryId: string, id: string, note: string): Promise<Result> {
  const post = await ownPost(supabase, userId, dictionaryId, id);
  if (!post) return { ok: false, error: "That post isn't yours.", status: 403 };
  const { error } = await supabase.from("posts").update({ status: "closed" }).eq("id", id).eq("author_user_id", userId);
  if (error) return { ok: false, error: error.message };
  const text = note.trim().slice(0, 500);
  if (text) {
    const { data: replies } = await supabase.from("post_replies").select("replier_user_id").eq("post_id", id);
    const repliers = [...new Set((replies ?? []).map((r) => r.replier_user_id as string))];
    // One at a time, so a thread with a block doesn't stop the rest.
    await Promise.all(
      repliers.map((replierId) => supabase.from("post_replies").insert({ post_id: id, replier_user_id: replierId, sender_user_id: userId, body: text })),
    );
  }
  return { ok: true };
}

export async function reopenPost(supabase: SupabaseClient, userId: string, dictionaryId: string, id: string): Promise<Result> {
  if (!(await ownPost(supabase, userId, dictionaryId, id))) return { ok: false, error: "That post isn't yours.", status: 403 };
  const { error } = await supabase.from("posts").update({ status: "open" }).eq("id", id).eq("author_user_id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Restarts the post's clock from now (the database sets the new expiry).
export async function renewPost(supabase: SupabaseClient, userId: string, dictionaryId: string, id: string): Promise<Result> {
  if (!(await ownPost(supabase, userId, dictionaryId, id))) return { ok: false, error: "That post isn't yours.", status: 403 };
  const { error } = await supabase
    .from("posts")
    .update({ renewed_at: new Date().toISOString(), status: "open" })
    .eq("id", id)
    .eq("author_user_id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deletePost(supabase: SupabaseClient, userId: string, dictionaryId: string, id: string): Promise<Result> {
  const post = await ownPost(supabase, userId, dictionaryId, id);
  if (!post) return { ok: false, error: "That post isn't yours.", status: 403 };
  const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_user_id", userId);
  if (error) return { ok: false, error: error.message };
  await removePhotos(supabase, post.photos ?? []);
  return { ok: true };
}
