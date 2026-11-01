"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fieldsOf, parseFields } from "@/lib/custom";
import { normalizeLabel } from "@/lib/dictionary-search";
import { PHOTO_BUCKET } from "@/lib/posts";
import type { Comment, Listing, Maker, Thread } from "@/lib/listings";

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function mustSignIn() {
  const { supabase, user } = await signedIn();
  if (!user) throw new Error("Log in first.");
  return { supabase, user };
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
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

const photoPaths = (raw: unknown) => (Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string").slice(0, 4) : []);

const photoUrl = (supabase: SupabaseClient, path: string) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;

export async function whoAmI(): Promise<string | null> {
  const { user } = await signedIn();
  return user?.id ?? null;
}

// --- Making and changing ---------------------------------------------------

export async function createListing(searchId: string, name: string, values: Record<string, string>, labels: string[] | string = [], photos: string[] = []) {
  const { supabase } = await mustSignIn();
  const { data, error } = await supabase.rpc("create_listing", {
    p_search: searchId,
    p_name: name,
    p_values: cleanValues(values),
    p_labels: labelList(labels),
    p_photos: photoPaths(photos),
  });
  fail(error);
  return data as string;
}

export async function saveListing(id: string, name: string, values: Record<string, string>, photos?: string[]) {
  const { supabase } = await mustSignIn();
  const { error } = await supabase.rpc("save_listing", {
    p_id: id,
    p_name: name,
    p_values: cleanValues(values),
    p_photos: photos ? photoPaths(photos) : null,
  });
  fail(error);
}

export async function deleteListing(id: string) {
  const { supabase } = await mustSignIn();
  const { data: d } = await supabase.from("dictionaries").select("photos").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("delete_listing", { p_id: id });
  fail(error);
  if (d?.photos?.length) await supabase.storage.from(PHOTO_BUCKET).remove(d.photos);
}

export async function setListingDone(id: string, done: boolean) {
  const { supabase } = await mustSignIn();
  fail((await supabase.rpc("set_listing_done", { p_id: id, p_done: done })).error);
}

export async function renewListing(id: string) {
  const { supabase } = await mustSignIn();
  fail((await supabase.rpc("renew_listing", { p_id: id })).error);
}

// --- Reading one --------------------------------------------------------------

export async function getListing(id: string): Promise<Listing | null> {
  const { supabase, user } = await signedIn();
  const me = user?.id ?? null;
  const [{ data: d }, { data: labels }, { data: opted }, { data: spark }, { data: comments }, { data: messages }, { data: isModerator }] =
    await Promise.all([
      supabase
        .from("dictionaries")
        .select("id, name, page, fields, by_name, created_at, owner_user_id, photos, photo_limit, lasts_days, expires_at, closed_at, hidden_at, spark_count")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("dictionary_labels").select("label").eq("dictionary_id", id).order("label"),
      me ? supabase.from("user_dictionaries").select("dictionary_id").eq("dictionary_id", id).eq("opted_in", true).maybeSingle() : Promise.resolve({ data: null }),
      me ? supabase.from("dictionary_sparks").select("user_id").eq("dictionary_id", id).eq("user_id", me).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("dictionary_comments").select("id, body, author_name, author_user_id, created_at, hidden_at").eq("dictionary_id", id).order("created_at").limit(200),
      me
        ? supabase.from("dictionary_messages").select("id, asker_user_id, sender_user_id, sender_name, body, read_at, created_at").eq("dictionary_id", id).order("created_at").limit(500)
        : Promise.resolve({ data: [] as { id: string; asker_user_id: string; sender_user_id: string; sender_name: string; body: string; read_at: string | null; created_at: string }[] }),
      me ? supabase.rpc("is_moderator") : Promise.resolve({ data: false }),
    ]);
  if (!d) return null;

  const mine = Boolean(me && d.owner_user_id === me);
  let blocked = false;
  if (me && !mine && d.owner_user_id) {
    const { data: b } = await supabase.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", me).eq("blocked_user_id", d.owner_user_id).maybeSingle();
    blocked = Boolean(b);
  }

  const threads = new Map<string, Thread>();
  for (const m of messages ?? []) {
    const t: Thread = threads.get(m.asker_user_id) ?? { askerId: m.asker_user_id, askerName: "", messages: [], unread: 0 };
    if (m.sender_user_id === m.asker_user_id && m.sender_name) t.askerName = m.sender_name;
    t.messages.push({ id: m.id, body: m.body, senderName: m.sender_name || "A Stardust spark", createdAt: m.created_at, mine: m.sender_user_id === me });
    if (!m.read_at && m.sender_user_id !== me) t.unread += 1;
    threads.set(m.asker_user_id, t);
  }

  return {
    id: d.id,
    name: d.name,
    values: (d.page ?? {}) as Record<string, string>,
    fields: fieldsOf(d.fields),
    labels: (labels ?? []).map((l) => l.label),
    photos: (d.photos ?? []).map((path: string) => ({ path, url: photoUrl(supabase, path) })),
    photoLimit: d.photo_limit ?? 0,
    byName: d.by_name || "A Stardust spark",
    createdAt: d.created_at,
    expiresAt: d.expires_at,
    canRenew: d.lasts_days !== null,
    done: d.closed_at !== null,
    hidden: d.hidden_at !== null,
    sparks: d.spark_count ?? 0,
    sparked: Boolean(spark),
    mine,
    optedIn: Boolean(opted),
    isModerator: Boolean(isModerator),
    blocked,
    comments: (comments ?? []).map(
      (c): Comment => ({
        id: c.id,
        body: c.body,
        authorName: c.author_name || "A Stardust spark",
        createdAt: c.created_at,
        mine: c.author_user_id === me,
        hidden: c.hidden_at !== null,
      }),
    ),
    threads: [...threads.values()].map((t) => ({ ...t, askerName: t.askerName || "A Stardust spark" })),
  };
}

// --- Talking about it --------------------------------------------------------

export async function toggleSpark(id: string) {
  const { supabase } = await mustSignIn();
  const { data, error } = await supabase.rpc("toggle_spark", { p_id: id });
  fail(error);
  return Boolean(data);
}

export async function addComment(id: string, body: string) {
  const { supabase, user } = await mustSignIn();
  const text = body.trim().slice(0, 2000);
  if (!text) throw new Error("Write something first.");
  fail((await supabase.from("dictionary_comments").insert({ dictionary_id: id, author_user_id: user.id, body: text })).error);
}

export async function deleteComment(commentId: string) {
  const { supabase } = await mustSignIn();
  fail((await supabase.from("dictionary_comments").delete().eq("id", commentId)).error);
}

// An empty askerId means the caller is starting (or continuing) their own
// thread with the maker.
export async function sendMessage(id: string, askerId: string, body: string) {
  const { supabase, user } = await mustSignIn();
  fail((await supabase.rpc("send_message", { p_id: id, p_asker: askerId || user.id, p_body: body })).error);
}

export async function readThread(id: string, askerId: string) {
  const { supabase } = await mustSignIn();
  await supabase.rpc("read_thread", { p_id: id, p_asker: askerId });
}

export async function report(id: string, commentId: string | null, reason: string, note: string) {
  const { supabase } = await mustSignIn();
  fail((await supabase.rpc("report_dictionary", { p_id: id, p_comment: commentId, p_reason: reason, p_note: note })).error);
}

// Blocks the person who made a listing: their listings and comments
// disappear for you, and neither of you can message the other.
export async function blockMaker(id: string) {
  const { supabase, user } = await mustSignIn();
  const { data: d } = await supabase.from("dictionaries").select("owner_user_id, by_name").eq("id", id).maybeSingle();
  if (!d?.owner_user_id || d.owner_user_id === user.id) throw new Error("You can't block yourself.");
  fail(
    (
      await supabase
        .from("user_blocks")
        .upsert({ blocker_user_id: user.id, blocked_user_id: d.owner_user_id, blocked_name: d.by_name ?? "" }, { onConflict: "blocker_user_id,blocked_user_id" })
    ).error,
  );
}

// --- Moderators -----------------------------------------------------------------

export type Waiting = { dictionaryId: string; commentId: string | null; name: string; body: string; hidden: boolean; reports: number; reasons: string[] };

export async function reportsWaiting(): Promise<Waiting[]> {
  const { supabase } = await mustSignIn();
  const { data, error } = await supabase.rpc("reports_waiting");
  fail(error);
  return (data ?? []).map((r: { dictionary_id: string; comment_id: string | null; name: string; body: string; hidden: boolean; reports: number; reasons: string[] }) => ({
    dictionaryId: r.dictionary_id,
    commentId: r.comment_id,
    name: r.name,
    body: r.body,
    hidden: r.hidden,
    reports: Number(r.reports),
    reasons: r.reasons ?? [],
  }));
}

export async function review(id: string, commentId: string | null, remove: boolean) {
  const { supabase } = await mustSignIn();
  fail((await supabase.rpc("review_dictionary", { p_id: id, p_comment: commentId, p_remove: remove })).error);
}

// --- Searches -------------------------------------------------------------------

// Every dictionary that makes listings, for the type picker.
export async function listMakers(): Promise<Maker[]> {
  const { supabase } = await signedIn();
  const { data } = await supabase.from("dictionaries").select("id, name, noun, fields, photo_limit, lasts_days").not("noun", "is", null).order("name").limit(100);
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    noun: d.noun as string,
    fields: fieldsOf(d.fields),
    photoLimit: d.photo_limit ?? 0,
    lastsDays: d.lasts_days ?? null,
  }));
}

export async function createSearch(input: { name: string; description: string; noun: string; shape: string; imports: string; photoLimit: number; lastsDays: number | null }) {
  const { supabase } = await mustSignIn();
  const fields = parseFields(input.shape);
  if ("error" in fields) throw new Error(fields.error);
  const { data, error } = await supabase.rpc("create_search", {
    p_name: input.name,
    p_description: input.description,
    p_noun: input.noun,
    p_fields: fields,
    p_imports: labelList(input.imports),
    p_photo_limit: input.photoLimit,
    p_lasts_days: input.lastsDays,
  });
  fail(error);
  return data as string;
}

export async function setShape(id: string, noun: string, shape: string, photoLimit: number, lastsDays: number | null) {
  const { supabase } = await mustSignIn();
  const fields = parseFields(shape);
  if ("error" in fields) throw new Error(fields.error);
  fail((await supabase.rpc("set_shape", { p_id: id, p_noun: noun, p_fields: fields, p_photo_limit: photoLimit, p_lasts_days: lastsDays })).error);
}

// A word list: a built dictionary with a word and its definition.
export async function createWordList(name: string, description: string) {
  const { supabase } = await mustSignIn();
  const { data, error } = await supabase.rpc("create_custom_dictionary", {
    p_name: name,
    p_description: description,
    p_fields: [
      { key: "word", label: "Word", type: "text" },
      { key: "definition", label: "Definition", type: "longtext" },
    ],
  });
  fail(error);
  return data as string;
}
