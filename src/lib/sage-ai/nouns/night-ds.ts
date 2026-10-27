import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTE_OR_NOTEPAD } from "@/lib/basics";
import { NOTE_LABELS, TIME_FRAMES, expiresAtFor, type TimeFrame } from "@/lib/time-frames";
import type { NounContext, NounDef, VerbResult } from "../engine";

// Night DS: notes that live for a time frame and archive themselves.

const NOTE_TARGET = "the note's number in the active list (1-based), or for archived and done notes the id from Find";

function expiresFor(ctx: NounContext, timeFrame: TimeFrame): string | null {
  return expiresAtFor(timeFrame, new Date(), ctx.timeZone)?.toISOString() ?? null;
}

// Active notes in position order. That order is what a note's number
// means everywhere. Expired notes are swept first so numbers match the
// Display View.
async function activeNotes(supabase: SupabaseClient, dictionaryId: string) {
  await supabase.rpc("sweep_expired_notes");
  const { data } = await supabase
    .from("notes")
    .select("id")
    .eq("dictionary_id", dictionaryId)
    .is("archived_at", null)
    .is("done_at", null)
    .order("position", { ascending: true });
  return data ?? [];
}

// A number picks an active note; anything else is a note id.
async function resolveNote(
  supabase: SupabaseClient,
  dictionaryId: string,
  target: string,
): Promise<{ id: string; label: string } | { error: string }> {
  if (/^\d+$/.test(target)) {
    const n = Number(target);
    const note = (await activeNotes(supabase, dictionaryId))[n - 1];
    return note ? { id: note.id, label: `note #${n}` } : { error: `No active note numbered ${n}.` };
  }
  const { data } = await supabase.from("notes").select("id").eq("dictionary_id", dictionaryId).eq("id", target).maybeSingle();
  return data ? { id: data.id, label: "the note" } : { error: `No note with id ${target}.` };
}

async function updateNote(
  supabase: SupabaseClient,
  dictionaryId: string,
  target: string,
  update: Record<string, unknown>,
  done: (label: string) => string,
): Promise<VerbResult> {
  const note = await resolveNote(supabase, dictionaryId, target);
  if ("error" in note) return { ok: false, error: note.error };
  const { error } = await supabase
    .from("notes")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", note.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: done(note.label) };
}

const timeFrameField = {
  name: "time_frame",
  type: "enum" as const,
  options: TIME_FRAMES,
  description: "How long the note lives. A day note archives at the user's midnight; life never expires.",
};
const labelField = { name: "label", type: "enum" as const, options: [...NOTE_LABELS, "none"] };

export const noteNoun: NounDef = {
  name: "Note",
  dictionary: "night-ds",
  description: "A note in Night DS. Notes have no title, only content, and live for a time frame. When it runs out the note archives itself.",
  notes: 'If the user doesn\'t say a time frame, pick the one their words imply ("today" is day, "this week" is week) and default to day. ' + NOTE_OR_NOTEPAD,
  verbs: {
    Add: {
      params: [{ name: "body", type: "text", required: true }, timeFrameField, labelField],
      run: async ({ ctx, dictionary, values }) => {
        const timeFrame = (values.time_frame as TimeFrame) ?? "day";
        const label = values.label && values.label !== "none" ? String(values.label) : null;
        if (!values.body) return { ok: false, error: "A note needs content." };
        const { error } = await ctx.supabase.from("notes").insert({
          dictionary_id: dictionary!.id,
          owner_user_id: ctx.userId,
          body: values.body,
          time_frame: timeFrame,
          label,
          expires_at: expiresFor(ctx, timeFrame),
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Wrote a new ${timeFrame} note${label ? ` labeled ${label}` : ""}.` };
      },
    },
    Edit: {
      description: "A new time frame starts its life now. Label none clears it.",
      target: NOTE_TARGET,
      params: [{ name: "body", type: "text" }, timeFrameField, labelField],
      run: async ({ ctx, dictionary, target, values }) => {
        const update: Record<string, unknown> = {};
        if (values.body) update.body = values.body;
        if (values.label) update.label = values.label === "none" ? null : values.label;
        if (values.time_frame) {
          update.time_frame = values.time_frame;
          update.expires_at = expiresFor(ctx, values.time_frame as TimeFrame);
        }
        if (Object.keys(update).length === 0) return { ok: false, error: "Need new content, a label, or a time frame." };
        return updateNote(ctx.supabase, dictionary!.id, target!, update, (l) => `Updated ${l}.`);
      },
    },
    Find: {
      description: "Search notes by content. Results give active notes a number and archived or done notes an id.",
      params: [
        { name: "query", type: "text", description: "Empty matches every note." },
        { name: "state", type: "enum", options: ["active", "archived", "done", "all"], description: "Default active." },
        timeFrameField,
        { name: "label", type: "enum", options: NOTE_LABELS },
      ],
      run: async ({ ctx, dictionary, values }) => {
        const active = await activeNotes(ctx.supabase, dictionary!.id);
        const numberById = new Map(active.map((n, i) => [n.id, i + 1]));
        const state = (values.state as string) ?? "active";

        let q = ctx.supabase
          .from("notes")
          .select("id, body, visibility, time_frame, label, expires_at, archived_at, done_at")
          .eq("dictionary_id", dictionary!.id);
        if (state === "active") q = q.is("archived_at", null).is("done_at", null);
        else if (state === "archived") q = q.not("archived_at", "is", null).is("done_at", null);
        else if (state === "done") q = q.not("done_at", "is", null);
        if (values.time_frame) q = q.eq("time_frame", values.time_frame);
        if (values.label) q = q.eq("label", values.label);
        if (values.query) q = q.ilike("body", `%${values.query}%`);

        const { data, error } = await q.limit(100);
        if (error) return { ok: false, error: error.message };

        const notes = (data ?? []).map((row) => {
          const number = numberById.get(row.id) ?? null;
          return {
            number,
            id: number === null ? row.id : undefined,
            state: row.done_at ? "done" : row.archived_at ? "archived" : "active",
            time_frame: row.time_frame,
            label: row.label,
            expires_at: row.expires_at,
            visibility: row.visibility,
            body: row.body,
          };
        });
        return { ok: true, message: `Found ${notes.length} note(s).`, data: notes };
      },
    },
    Archive: {
      description: "Set a note aside before its time frame runs out.",
      target: NOTE_TARGET,
      run: ({ ctx, dictionary, target }) =>
        updateNote(ctx.supabase, dictionary!.id, target!, { archived_at: new Date().toISOString() }, (l) => `Archived ${l}.`),
    },
    Restore: {
      description: "Bring an archived or done note back with a fresh time frame. Ask which time frame if the user hasn't said.",
      target: "the note's id from Find",
      params: [{ ...timeFrameField, required: true }],
      run: async ({ ctx, target, values }) => {
        const timeFrame = values.time_frame as TimeFrame;
        const { error } = await ctx.supabase.rpc("restore_note", {
          p_note_id: target,
          p_time_frame: timeFrame,
          p_expires_at: expiresFor(ctx, timeFrame),
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Restored the note as a ${timeFrame} note.` };
      },
    },
    Delete: {
      description: "Erase a note for good.",
      target: NOTE_TARGET,
      run: async ({ ctx, dictionary, target }) => {
        const note = await resolveNote(ctx.supabase, dictionary!.id, target!);
        if ("error" in note) return { ok: false, error: note.error };
        const { error } = await ctx.supabase.from("notes").delete().eq("id", note.id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Deleted ${note.label}.` };
      },
    },
    Share: {
      description: "Set a note public (other users can read it) or private.",
      target: NOTE_TARGET,
      params: [{ name: "visibility", type: "enum", options: ["public", "private"], required: true }],
      run: ({ ctx, dictionary, target, values }) =>
        updateNote(ctx.supabase, dictionary!.id, target!, { visibility: values.visibility }, (l) => `${l[0].toUpperCase()}${l.slice(1)} is now ${values.visibility}.`),
    },
  },
  actions: {
    Done: {
      description: "Mark a note done. Done notes move to their own archive, so the user can look back at what they did.",
      target: NOTE_TARGET,
      run: ({ ctx, dictionary, target }) =>
        updateNote(ctx.supabase, dictionary!.id, target!, { done_at: new Date().toISOString() }, (l) => `${l[0].toUpperCase()}${l.slice(1)} is done.`),
    },
  },
};
