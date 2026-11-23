"use server";

import { createClient } from "@/lib/supabase/server";
import { cleanDetails, type EntryKind } from "@/lib/profile-entries";

// Create and save, straight from the page. The type picks where a word
// lives and how its card works.

export type WordType =
  | "noun"
  | "org"
  | "idea"
  | "job"
  | "resource"
  | "person"
  | "notes"
  | "journal"
  | "group";

export type WordDraft = {
  type: WordType;
  word: string;
  body: string;
  place: string;
  people: string;
  visibility: string;
  // org: kind (business|government|nonprofit|other), website
  // entries: side (offer|seek) plus their details
  // group: style (night|journal) for the shared notebook
  details: Record<string, string>;
};

// What the page needs to open what was made.
export type Made =
  | { open: "word"; kind: string; id: string }
  | { open: "view"; id: string; name: string; displayKind: string; belongs: "personal" | "group" };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in first.");
  return { supabase, user };
}


export async function createWord(d: WordDraft): Promise<Made> {
  const { supabase, user } = await signedIn();
  const word = d.word.trim().slice(0, 120);
  if (!word) throw new Error("Give it a word.");

  switch (d.type) {
    case "noun": {
      const { data, error } = await supabase
        .from("my_words")
        .insert({ owner_user_id: user.id, word, body: d.body, place: d.place, people: d.people, visibility: "private" })
        .select("id")
        .single();
      if (error) throw new Error(/my_words/.test(error.message) ? "Nouns need migration 0050." : error.message);
      return { open: "word", kind: "mine", id: data.id };
    }
    case "org": {
      const { data, error } = await supabase.rpc("create_organization", {
        p_name: word,
        p_kind: d.details.kind || "other",
        p_website: d.details.website ?? "",
        // A board in plain text: start with sections they can change or delete.
        p_about: d.body.trim() || "Mission\n\n\nAnnouncements\n\n\nContact\n",
        p_place: d.place,
        p_people: d.people,
        p_visibility: "public",
      });
      if (error) throw new Error(error.message);
      return { open: "word", kind: "organization", id: data as string };
    }
    case "idea": {
      // A journal anyone can read.
      const { data: id, error } = await supabase.rpc("create_idea", { p_name: word });
      if (error) throw new Error(/create_idea/.test(error.message) ? "Ideas need migration 0054." : error.message);
      if (d.body.trim()) {
        await supabase.from("journal_entries").insert({ dictionary_id: id, owner_user_id: user.id, body: d.body.trim(), place: d.place, people: d.people });
      }
      return { open: "view", id: id as string, name: word, displayKind: "journal", belongs: "personal" };
    }
    case "job":
    case "resource":
    case "person": {
      const kind = d.type as EntryKind;
      const details = cleanDetails(kind, d.details);
      if (kind === "person" && !details.relationship) details.relationship = "friendship";
      const { data, error } = await supabase
        .from("profile_entries")
        .insert({
          owner_user_id: user.id,
          kind,
          side: d.details.side === "seek" ? "seek" : "offer",
          word,
          body: d.body,
          place: d.place,
          people: d.people,
          visibility: "public",
          details,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { open: "word", kind, id: data.id };
    }
    case "notes":
    case "journal":
    case "group": {
      const style = d.type === "group" ? (d.details.style === "journal" ? "journal" : "night") : d.type === "notes" ? "night" : "journal";
      const shared = d.type === "group";
      const { data: id, error } = await supabase.rpc("create_notebook", { p_style: style, p_name: word, p_shared: shared });
      if (error) throw new Error(error.message);
      // The body becomes its first note or entry.
      if (d.body.trim()) {
        if (style === "night") {
          await supabase.from("notes").insert({ dictionary_id: id, owner_user_id: user.id, body: d.body.trim(), place: d.place, people: d.people, time_frame: "life" });
        } else {
          await supabase.from("journal_entries").insert({ dictionary_id: id, owner_user_id: user.id, body: d.body.trim(), place: d.place, people: d.people });
        }
      }
      // A group starts with the people named in People, when they're emails.
      if (shared) {
        for (const email of d.people.split(/[,\s]+/).filter((e) => /^\S+@\S+\.\S+$/.test(e)).slice(0, 30)) {
          await supabase.rpc("add_group_member", { p_dictionary_id: id, p_email: email });
        }
      }
      return { open: "view", id: id as string, name: word, displayKind: style === "night" ? "notes_list" : "journal", belongs: shared ? "group" : "personal" };
    }
  }
}

// Saves the open word's word, body, and tags.
export async function saveWord(kind: string, id: string, w: { word: string; body: string; place: string; people: string; visibility: string }) {
  const { supabase, user } = await signedIn();
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  if (kind === "mine") {
    const row: Record<string, string> = { word: w.word.trim().slice(0, 120), body: w.body, place: w.place, people: w.people };
    fail((await supabase.from("my_words").update(row).eq("id", id).eq("owner_user_id", user.id)).error);
  } else if (["idea", "job", "resource", "person"].includes(kind)) {
    const row: Record<string, string> = { word: w.word.trim().slice(0, 120), body: w.body, place: w.place, people: w.people };
    fail((await supabase.from("profile_entries").update(row).eq("id", id).eq("owner_user_id", user.id)).error);
  } else if (kind === "organization") {
    const { data: org } = await supabase.from("organizations").select("kind, website").eq("id", id).maybeSingle();
    fail(
      (
        await supabase.rpc("save_organization", {
          p_id: id,
          p_name: w.word,
          p_kind: org?.kind ?? "other",
          p_website: org?.website ?? "",
          p_about: w.body,
          p_place: w.place,
          p_people: w.people,
          p_visibility: null,
        })
      ).error,
    );
  } else if (kind === "note") {
    const row: Record<string, string> = { body: w.body, place: w.place, people: w.people };
    fail((await supabase.from("notes").update(row).eq("id", id).eq("owner_user_id", user.id)).error);
  } else if (kind === "journal") {
    fail((await supabase.from("journal_entries").update({ body: w.body, place: w.place, people: w.people }).eq("id", id).eq("owner_user_id", user.id)).error);
  } else {
    throw new Error("That word can't be changed here.");
  }
}

// --- Inbox: hello threads on your entries and the ones you started -------------

export type Thread = {
  entryId: string;
  askerId: string;
  entryWord: string;
  withName: string;
  mine: boolean;
  last: string;
  lastAt: string;
  unread: number;
};

export async function inboxThreads(): Promise<Thread[]> {
  const { supabase, user } = await signedIn();
  const { data, error } = await supabase
    .from("profile_entry_messages")
    .select("entry_id, asker_user_id, sender_user_id, sender_name, body, read_at, created_at, entry:profile_entries(word, owner_user_id, owner_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const threads = new Map<string, Thread>();
  for (const m of data ?? []) {
    const e = Array.isArray(m.entry) ? m.entry[0] : m.entry;
    const key = `${m.entry_id}:${m.asker_user_id}`;
    const mineEntry = e?.owner_user_id === user.id;
    let t = threads.get(key);
    if (!t) {
      t = {
        entryId: m.entry_id,
        askerId: m.asker_user_id,
        entryWord: e?.word ?? "an entry",
        withName: mineEntry ? "" : e?.owner_name || "a spark",
        mine: mineEntry,
        last: m.body,
        lastAt: m.created_at,
        unread: 0,
      };
      threads.set(key, t);
    }
    if (mineEntry && !t.withName && m.sender_user_id !== user.id) t.withName = m.sender_name || "a spark";
    if (m.sender_user_id !== user.id && !m.read_at) t.unread += 1;
  }
  return [...threads.values()].map((t) => ({ ...t, withName: t.withName || "a spark" }));
}

export type Message = { mine: boolean; name: string; body: string; at: string };

export async function threadMessages(entryId: string, askerId: string): Promise<Message[]> {
  const { supabase, user } = await signedIn();
  const { data, error } = await supabase
    .from("profile_entry_messages")
    .select("sender_user_id, sender_name, body, created_at")
    .eq("entry_id", entryId)
    .eq("asker_user_id", askerId)
    .order("created_at")
    .limit(500);
  if (error) throw new Error(error.message);
  await supabase.rpc("mark_hellos_read", { p_entry: entryId, p_asker: askerId });
  return (data ?? []).map((m) => ({ mine: m.sender_user_id === user.id, name: m.sender_name || "a spark", body: m.body, at: m.created_at }));
}

export async function sendHello(entryId: string, body: string, askerId?: string) {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("say_hello", { p_entry: entryId, p_body: body, p_asker: askerId ?? null });
  if (error) throw new Error(error.message);
}

// --- Settings ---------------------------------------------------------------------

export async function getDisplayName(): Promise<string> {
  const { supabase, user } = await signedIn();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return data?.display_name ?? "";
}

// The name other sparks see on your words, groups, and messages.
export async function setDisplayName(name: string) {
  const { supabase, user } = await signedIn();
  const clean = name.trim().slice(0, 60);
  const { error } = await supabase.from("profiles").update({ display_name: clean || null }).eq("id", user.id);
  if (error) throw new Error(error.message);
}
