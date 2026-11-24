"use server";

import { createClient } from "@/lib/supabase/server";
import { cleanDetails, ENTRY_COLUMNS, toEntry, type EntryKind, type ProfileEntry, type Side } from "@/lib/profile-entries";

async function mustSignIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in first.");
  return { supabase, user };
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function myEntries(): Promise<ProfileEntry[]> {
  const { supabase, user } = await mustSignIn();
  const { data, error } = await supabase
    .from("profile_entries")
    .select(ENTRY_COLUMNS)
    .eq("owner_user_id", user.id)
    .order("kind")
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((r) => toEntry(r, user.id));
}

export type EntryInput = {
  kind: EntryKind;
  side: Side;
  word: string;
  body: string;
  place: string;
  people: string;
  visibility: "public" | "private";
  details: Record<string, string>;
};

export async function saveEntry(id: string | null, input: EntryInput) {
  const { supabase, user } = await mustSignIn();
  const row = {
    side: input.side,
    word: input.word.trim().slice(0, 120),
    body: input.body.slice(0, 5000),
    place: input.place.trim().slice(0, 120),
    people: input.people.trim().slice(0, 300),
    visibility: "public", // profile is always public; pause hides one
    details: cleanDetails(input.kind, input.details),
  };
  if (!row.word) throw new Error("Give it a word: a short title.");
  if (id) {
    fail((await supabase.from("profile_entries").update(row).eq("id", id).eq("owner_user_id", user.id)).error);
  } else {
    fail((await supabase.from("profile_entries").insert({ ...row, kind: input.kind, owner_user_id: user.id })).error);
  }
}

export async function deleteEntry(id: string) {
  const { supabase, user } = await mustSignIn();
  fail((await supabase.from("profile_entries").delete().eq("id", id).eq("owner_user_id", user.id)).error);
}

export async function pauseEntry(id: string, paused: boolean) {
  const { supabase, user } = await mustSignIn();
  fail((await supabase.from("profile_entries").update({ paused }).eq("id", id).eq("owner_user_id", user.id)).error);
}

export async function isAdult(): Promise<boolean> {
  const { supabase, user } = await mustSignIn();
  const { data } = await supabase.from("adult_confirmations").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
}

// Checks the birth date here; only the yes is stored.
export async function confirmAdult(birthDate: string) {
  const { supabase, user } = await mustSignIn();
  const m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("Enter your birth date.");
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age -= 1;
  if (age < 18) throw new Error("Romance is for 18 and older.");
  fail((await supabase.from("adult_confirmations").upsert({ user_id: user.id }, { onConflict: "user_id" })).error);
}

// --- Moderators -----------------------------------------------------------------

export type WaitingEntry = { id: string; word: string; body: string; ownerName: string; hidden: boolean; reports: number; reasons: string[] };

export async function entryReportsWaiting(): Promise<WaitingEntry[]> {
  const { supabase } = await mustSignIn();
  const { data, error } = await supabase.rpc("profile_entry_reports_waiting");
  fail(error);
  return (data ?? []).map((r: { entry_id: string; word: string; body: string; owner_name: string; hidden: boolean; reports: number; reasons: string[] }) => ({
    id: r.entry_id,
    word: r.word,
    body: r.body,
    ownerName: r.owner_name,
    hidden: r.hidden,
    reports: Number(r.reports),
    reasons: (r.reasons ?? []).filter(Boolean),
  }));
}

export async function reviewEntry(id: string, remove: boolean) {
  const { supabase } = await mustSignIn();
  fail((await supabase.rpc("review_profile_entry", { p_id: id, p_remove: remove })).error);
}
