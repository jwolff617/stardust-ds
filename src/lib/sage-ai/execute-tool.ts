import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePersonalInstance, findPersonalInstance } from "@/lib/personal-instance";
import { fetchDefinitions, getOptedInDictionaries } from "@/lib/dictionary";
import { addDictionaryLabel, removeDictionaryLabel } from "@/lib/dictionary-labels";
import { searchDictionaries } from "@/lib/dictionary-search";

const NIGHT_DS_ADDRESS = "night-ds";

async function getDictionaryId(supabase: SupabaseClient, address: string): Promise<string> {
  const { data, error } = await supabase
    .from("dictionaries")
    .select("id")
    .eq("address", address)
    .single();

  if (error || !data) throw new Error(`Dictionary "${address}" doesn't exist.`);
  return data.id;
}

// Resolves (auto-provisioning if needed) the caller's own Night DS notes
// instance -- notes live there, never on the shared night-ds template.
async function getNightDsInstanceId(
  supabase: SupabaseClient,
  userId: string,
  displayName: string | null,
): Promise<string> {
  const templateId = await getDictionaryId(supabase, NIGHT_DS_ADDRESS);
  return ensurePersonalInstance(supabase, userId, templateId, displayName);
}

async function findDictionary(supabase: SupabaseClient, nameOrAddress: string) {
  const { data } = await supabase
    .from("dictionaries")
    .select("id, name, address, locked, kind, owner_user_id")
    .or(`name.ilike.${nameOrAddress},address.ilike.${nameOrAddress}`)
    .neq("kind", "instance")
    .limit(1)
    .maybeSingle();

  return data;
}

// Active notes ordered by position -- this order is what "note number" means
// everywhere (Display View, Sage AI). Numbers are 1-based ranks, not stored.
async function findActiveNotes(supabase: SupabaseClient, userId: string, instanceId: string) {
  const { data } = await supabase
    .from("notes")
    .select("id, body, archive_id, visibility")
    .eq("dictionary_id", instanceId)
    .eq("owner_user_id", userId)
    .is("archive_id", null)
    .order("position", { ascending: true });

  return data ?? [];
}

async function findNoteByNumber(
  supabase: SupabaseClient,
  userId: string,
  instanceId: string,
  number: number,
) {
  const notes = await findActiveNotes(supabase, userId, instanceId);
  return notes[number - 1] ?? null;
}

export type ToolResult = { ok: true; message: string; data?: unknown } | { ok: false; error: string };

export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  input: Record<string, unknown>,
  displayName: string | null,
): Promise<ToolResult> {
  switch (toolName) {
    case "note_write": {
      const body = String(input.body ?? "").trim();
      if (!body) return { ok: false, error: "A note needs content." };

      const instanceId = await getNightDsInstanceId(supabase, userId, displayName);
      const { error } = await supabase
        .from("notes")
        .insert({ dictionary_id: instanceId, owner_user_id: userId, body });
      if (error) return { ok: false, error: error.message };

      return { ok: true, message: "Wrote a new note." };
    }

    case "note_edit": {
      const number = Number(input.number ?? NaN);
      const body = String(input.body ?? "").trim();
      if (!Number.isInteger(number) || number < 1 || !body) {
        return { ok: false, error: "Need the note's number and its new content." };
      }

      const instanceId = await getNightDsInstanceId(supabase, userId, displayName);
      const note = await findNoteByNumber(supabase, userId, instanceId, number);
      if (!note) return { ok: false, error: `No active note numbered ${number}.` };

      const { error } = await supabase
        .from("notes")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", note.id);
      if (error) return { ok: false, error: error.message };

      return { ok: true, message: `Updated note #${number}.` };
    }

    case "note_search": {
      const query = String(input.query ?? "").trim();
      const includeArchived = Boolean(input.includeArchived);

      const instanceId = await getNightDsInstanceId(supabase, userId, displayName);
      const activeNotes = await findActiveNotes(supabase, userId, instanceId);
      const numberById = new Map(activeNotes.map((note, i) => [note.id, i + 1]));

      let q = supabase
        .from("notes")
        .select("id, body, archive_id, visibility")
        .eq("dictionary_id", instanceId)
        .eq("owner_user_id", userId);
      if (!includeArchived) q = q.is("archive_id", null);
      if (query) q = q.ilike("body", `%${query}%`);

      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };

      const notes = (data ?? []).map((row) => ({
        number: numberById.get(row.id) ?? null,
        archived: row.archive_id !== null,
        visibility: row.visibility,
        body: row.body,
      }));

      return { ok: true, message: `Found ${notes.length} note(s).`, data: notes };
    }

    case "note_delete": {
      const number = Number(input.number ?? NaN);
      if (!Number.isInteger(number) || number < 1) return { ok: false, error: "Need the note's number." };

      const instanceId = await getNightDsInstanceId(supabase, userId, displayName);
      const note = await findNoteByNumber(supabase, userId, instanceId, number);
      if (!note) return { ok: false, error: `No active note numbered ${number}.` };

      const { error } = await supabase.from("notes").delete().eq("id", note.id);
      if (error) return { ok: false, error: error.message };

      return { ok: true, message: `Deleted note #${number}.` };
    }

    case "note_share": {
      const number = Number(input.number ?? NaN);
      const visibility = String(input.visibility ?? "").trim();
      if (!Number.isInteger(number) || number < 1) return { ok: false, error: "Need the note's number." };
      if (visibility !== "public" && visibility !== "private") {
        return { ok: false, error: "Visibility must be 'public' or 'private'." };
      }

      const instanceId = await getNightDsInstanceId(supabase, userId, displayName);
      const note = await findNoteByNumber(supabase, userId, instanceId, number);
      if (!note) return { ok: false, error: `No active note numbered ${number}.` };

      const { error } = await supabase
        .from("notes")
        .update({ visibility, updated_at: new Date().toISOString() })
        .eq("id", note.id);
      if (error) return { ok: false, error: error.message };

      return { ok: true, message: `Note #${number} is now ${visibility}.` };
    }

    case "info_search": {
      const query = String(input.query ?? "").trim().toLowerCase();
      if (!query) return { ok: false, error: "Need something to search for." };

      const dictionaries = await getOptedInDictionaries(supabase);
      const definitions = await fetchDefinitions(supabase, {
        dictionaryIds: dictionaries.map((d) => d.id),
        partsOfSpeech: ["verb", "noun", "more"],
      });

      const matches = definitions.filter(
        (d) =>
          d.term.toLowerCase().includes(query) || d.body.toLowerCase().includes(query),
      );

      return {
        ok: true,
        message: `Found ${matches.length} match(es).`,
        data: matches.map((m) => ({ term: m.term, body: m.body, dictionary: m.dictionaryName })),
      };
    }

    case "dictionary_add": {
      const name = String(input.dictionary ?? "").trim();
      const dictionary = await findDictionary(supabase, name);
      if (!dictionary) return { ok: false, error: `No dictionary matches "${name}".` };

      // Instance-template dictionaries (e.g. Night DS) resolve to the
      // caller's own personal instance rather than being opted into directly.
      if (dictionary.kind === "instance_template") {
        await ensurePersonalInstance(supabase, userId, dictionary.id, displayName);
        return { ok: true, message: `Added "${dictionary.name}".` };
      }

      const { error } = await supabase
        .from("user_dictionaries")
        .upsert(
          { user_id: userId, dictionary_id: dictionary.id, opted_in: true },
          { onConflict: "user_id,dictionary_id" },
        );
      if (error) return { ok: false, error: error.message };

      return { ok: true, message: `Added "${dictionary.name}".` };
    }

    case "dictionary_remove": {
      const name = String(input.dictionary ?? "").trim();
      const dictionary = await findDictionary(supabase, name);
      if (!dictionary) return { ok: false, error: `No dictionary matches "${name}".` };
      if (dictionary.locked) return { ok: false, error: `${dictionary.name} is always on and can't be removed.` };

      let dictionaryId = dictionary.id;
      if (dictionary.kind === "instance_template") {
        const instance = await findPersonalInstance(supabase, userId, dictionary.id);
        if (!instance) return { ok: true, message: `"${dictionary.name}" isn't added.` };
        dictionaryId = instance.id;
      }

      const { error } = await supabase
        .from("user_dictionaries")
        .upsert(
          { user_id: userId, dictionary_id: dictionaryId, opted_in: false },
          { onConflict: "user_id,dictionary_id" },
        );
      if (error) return { ok: false, error: error.message };

      return { ok: true, message: `Removed "${dictionary.name}".` };
    }

    case "dictionary_find": {
      const query = String(input.query ?? "").trim();
      if (!query) return { ok: false, error: "Need something to look for." };

      const results = await searchDictionaries(supabase, query, userId);
      return {
        ok: true,
        message: `Found ${results.length} dictionar${results.length === 1 ? "y" : "ies"}.`,
        data: results.map((d) => ({
          name: d.instance?.name ?? d.name,
          description: d.isOtherProfile ? null : d.description,
          labels: [...d.labels, ...d.ownLabels],
          on: d.optedIn,
          publicProfile: d.isOtherProfile,
        })),
      };
    }

    case "dictionary_label": {
      const name = String(input.dictionary ?? "").trim();
      const label = String(input.label ?? "");
      const action = String(input.action ?? "");
      if (action !== "add" && action !== "remove") {
        return { ok: false, error: "Action must be 'add' or 'remove'." };
      }

      const dictionary = await findDictionary(supabase, name);
      if (!dictionary) return { ok: false, error: `No dictionary matches "${name}".` };

      // Labeling a template labels the caller's own instance of it.
      let dictionaryId: string | null = null;
      if (dictionary.kind === "instance_template") {
        const instance = await findPersonalInstance(supabase, userId, dictionary.id);
        if (!instance) return { ok: false, error: `Add "${dictionary.name}" first, then label it.` };
        dictionaryId = instance.id;
      } else if (dictionary.owner_user_id === userId) {
        dictionaryId = dictionary.id;
      }
      if (!dictionaryId) return { ok: false, error: `You can only label dictionaries you own.` };

      const result =
        action === "add"
          ? await addDictionaryLabel(supabase, dictionaryId, label)
          : await removeDictionaryLabel(supabase, dictionaryId, label);
      if (!result.ok) return result;

      return {
        ok: true,
        message:
          action === "add"
            ? `Labeled "${dictionary.name}" with "${result.label}".`
            : `Removed "${result.label}" from "${dictionary.name}".`,
      };
    }

    case "profile_edit": {
      const profile = String(input.profile ?? "");
      const field = String(input.field ?? "").trim();
      if ((profile !== "private" && profile !== "public") || !field) {
        return { ok: false, error: "Need the profile (private or public) and a field name." };
      }

      const update: { value?: string; visibility?: string } = {};
      if (typeof input.value === "string") update.value = input.value.trim();
      if (input.visibility === "public" || input.visibility === "private") update.visibility = input.visibility;
      if (Object.keys(update).length === 0) return { ok: false, error: "Need a new value or visibility." };

      const templateId = await getDictionaryId(supabase, `${profile}-profile`);
      const instance = await findPersonalInstance(supabase, userId, templateId);
      if (!instance) return { ok: false, error: "Your profile isn't set up yet." };

      const { data, error } = await supabase
        .from("profile_fields")
        .update(update)
        .eq("dictionary_id", instance.id)
        .ilike("name", field)
        .select("name, visibility");
      if (error) return { ok: false, error: error.message };
      if (!data || data.length === 0) return { ok: false, error: `No field named "${field}".` };

      return { ok: true, message: `Updated ${data[0].name} (${data[0].visibility}).` };
    }

    default:
      return { ok: false, error: `Unknown tool "${toolName}".` };
  }
}
