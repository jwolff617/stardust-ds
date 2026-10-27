import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePersonalInstance, findPersonalInstance } from "@/lib/personal-instance";
import { fetchDefinitions, getOptedInDictionaries } from "@/lib/dictionary";
import { addDictionaryLabel, removeDictionaryLabel } from "@/lib/dictionary-labels";
import { searchDictionaries } from "@/lib/dictionary-search";
import type { NounDef } from "../engine";

// Core nouns: every spark has them, whatever else is on.

async function findDictionary(supabase: SupabaseClient, nameOrAddress: string) {
  const { data } = await supabase
    .from("dictionaries")
    .select("id, name, address, locked, kind, scope, owner_user_id")
    .or(`name.ilike.${nameOrAddress},address.ilike.${nameOrAddress}`)
    .neq("kind", "instance")
    .limit(1)
    .maybeSingle();
  return data;
}

const DICTIONARY_TARGET = "the dictionary's name or address, e.g. 'Night DS'";

export const dictionaryNoun: NounDef = {
  name: "Dictionary",
  dictionary: "core",
  alwaysOn: true,
  description: "A named set of words that is also an app. Turning one on makes its nouns available.",
  verbs: {
    Add: {
      description: "Turn a dictionary on. A personal template (Night DS) makes the user's own copy. A group template (After School DS) needs a group name the first time, so send them to the Dictionaries panel for that.",
      target: DICTIONARY_TARGET,
      run: async ({ ctx, target }) => {
        const dictionary = await findDictionary(ctx.supabase, target!);
        if (!dictionary) return { ok: false, error: `No dictionary matches "${target}".` };

        if (dictionary.kind === "instance_template") {
          if (dictionary.scope === "group") {
            const instance = await findPersonalInstance(ctx.supabase, ctx.userId, dictionary.id);
            if (!instance) {
              return { ok: false, error: `${dictionary.name} makes a group, which needs a name. Click it in the Dictionaries panel to name your group.` };
            }
            const { error } = await ctx.supabase
              .from("user_dictionaries")
              .upsert({ user_id: ctx.userId, dictionary_id: instance.id, opted_in: true }, { onConflict: "user_id,dictionary_id" });
            if (error) return { ok: false, error: error.message };
            return { ok: true, message: `Turned on "${instance.name}".` };
          }
          await ensurePersonalInstance(ctx.supabase, ctx.userId, dictionary.id, ctx.displayName);
          return { ok: true, message: `Added "${dictionary.name}".` };
        }

        const { error } = await ctx.supabase
          .from("user_dictionaries")
          .upsert({ user_id: ctx.userId, dictionary_id: dictionary.id, opted_in: true }, { onConflict: "user_id,dictionary_id" });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Added "${dictionary.name}".` };
      },
    },
    Remove: {
      description: "Turn a dictionary off. Locked ones (Core, Stardust, both Profiles) always stay on.",
      target: DICTIONARY_TARGET,
      run: async ({ ctx, target }) => {
        const dictionary = await findDictionary(ctx.supabase, target!);
        if (!dictionary) return { ok: false, error: `No dictionary matches "${target}".` };
        if (dictionary.locked) return { ok: false, error: `${dictionary.name} is always on and can't be removed.` };

        let dictionaryId = dictionary.id;
        if (dictionary.kind === "instance_template") {
          const instance = await findPersonalInstance(ctx.supabase, ctx.userId, dictionary.id);
          if (!instance) return { ok: true, message: `"${dictionary.name}" isn't added.` };
          dictionaryId = instance.id;
        }

        const { error } = await ctx.supabase
          .from("user_dictionaries")
          .upsert({ user_id: ctx.userId, dictionary_id: dictionaryId, opted_in: false }, { onConflict: "user_id,dictionary_id" });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Removed "${dictionary.name}".` };
      },
    },
    Find: {
      description: "Look for dictionaries by name, description, or label. Also finds other sparks' Public Profiles.",
      params: [{ name: "query", type: "text", required: true }],
      run: async ({ ctx, values }) => {
        const results = await searchDictionaries(ctx.supabase, String(values.query), ctx.userId);
        return {
          ok: true,
          message: `Found ${results.length} dictionar${results.length === 1 ? "y" : "ies"}.`,
          data: results.map((d) => ({
            name: d.instance?.name ?? d.name,
            description: d.isOtherProfile ? null : d.description,
            class: d.scope,
            labels: [...d.labels, ...d.ownLabels],
            on: d.optedIn,
            publicProfile: d.isOtherProfile,
          })),
        };
      },
    },
    Label: {
      description: "Add or remove a label on a dictionary the user owns, including their own copies (Night DS, Public Profile). Labels help people find it.",
      target: DICTIONARY_TARGET,
      params: [
        { name: "label", type: "text", required: true, max: 40 },
        { name: "action", type: "enum", options: ["add", "remove"], required: true },
      ],
      run: async ({ ctx, target, values }) => {
        const dictionary = await findDictionary(ctx.supabase, target!);
        if (!dictionary) return { ok: false, error: `No dictionary matches "${target}".` };

        let dictionaryId: string | null = null;
        if (dictionary.kind === "instance_template") {
          const instance = await findPersonalInstance(ctx.supabase, ctx.userId, dictionary.id);
          if (!instance) return { ok: false, error: `Add "${dictionary.name}" first, then label it.` };
          dictionaryId = instance.id;
        } else if (dictionary.owner_user_id === ctx.userId) {
          dictionaryId = dictionary.id;
        }
        if (!dictionaryId) return { ok: false, error: "You can only label dictionaries you own." };

        const label = String(values.label);
        const result =
          values.action === "add"
            ? await addDictionaryLabel(ctx.supabase, dictionaryId, label)
            : await removeDictionaryLabel(ctx.supabase, dictionaryId, label);
        if (!result.ok) return result;
        return {
          ok: true,
          message:
            values.action === "add"
              ? `Labeled "${dictionary.name}" with "${result.label}".`
              : `Removed "${result.label}" from "${dictionary.name}".`,
        };
      },
    },
  },
};

export const termNoun: NounDef = {
  name: "Term",
  dictionary: "core",
  alwaysOn: true,
  description: "A word and its definition in a dictionary the user has on.",
  verbs: {
    Find: {
      description: "Look up words and definitions across every dictionary the user has on.",
      params: [{ name: "query", type: "text", required: true }],
      run: async ({ ctx, values }) => {
        const query = String(values.query).toLowerCase();
        const dictionaries = await getOptedInDictionaries(ctx.supabase);
        const definitions = await fetchDefinitions(ctx.supabase, {
          dictionaryIds: dictionaries.map((d) => d.id),
          partsOfSpeech: ["verb", "noun", "more"],
        });
        const matches = definitions.filter(
          (d) => d.term.toLowerCase().includes(query) || d.body.toLowerCase().includes(query),
        );
        return {
          ok: true,
          message: `Found ${matches.length} match(es).`,
          data: matches.map((m) => ({ term: m.term, body: m.body, dictionary: m.dictionaryName })),
        };
      },
    },
  },
};

export const profileFieldNoun: NounDef = {
  name: "Profile Field",
  dictionary: "core",
  alwaysOn: true,
  description: "One field on the user's Private Profile (registration, payment) or Public Profile (contact, neighborhood, city, who they are).",
  notes: "Never ask for or accept card numbers. Payment runs through a payment processor.",
  verbs: {
    Edit: {
      description: "Change a field's value, and for the Public Profile whether it's public.",
      target: "the field's name, e.g. 'Neighborhood' or 'City'",
      params: [
        { name: "profile", type: "enum", options: ["private", "public"], required: true },
        { name: "value", type: "text", description: "Leave out to only change visibility." },
        { name: "visibility", type: "enum", options: ["public", "private"] },
      ],
      run: async ({ ctx, target, values }) => {
        const update: { value?: string; visibility?: string } = {};
        if (typeof values.value === "string") update.value = values.value;
        if (typeof values.visibility === "string") update.visibility = values.visibility;
        if (Object.keys(update).length === 0) return { ok: false, error: "Need a new value or visibility." };

        const { data: template } = await ctx.supabase
          .from("dictionaries")
          .select("id")
          .eq("address", `${values.profile}-profile`)
          .single();
        const instance = template ? await findPersonalInstance(ctx.supabase, ctx.userId, template.id) : null;
        if (!instance) return { ok: false, error: "Your profile isn't set up yet." };

        const { data, error } = await ctx.supabase
          .from("profile_fields")
          .update(update)
          .eq("dictionary_id", instance.id)
          .ilike("name", target!)
          .select("name, visibility");
        if (error) return { ok: false, error: error.message };
        if (!data || data.length === 0) return { ok: false, error: `No field named "${target}".` };
        return { ok: true, message: `Updated ${data[0].name} (${data[0].visibility}).` };
      },
    },
  },
};
