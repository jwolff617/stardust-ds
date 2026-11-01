import { fieldsOf, valuesFromText } from "@/lib/custom";
import { findLabeledDictionaries } from "@/lib/dictionary-labels";
import { normalizeLabel } from "@/lib/dictionary-search";
import type { NounDef, VerbResult } from "../engine";

// Listings: the small dictionaries searches make (an idea in Idea Index, a
// couch in Marketplace, a job in Job Match, or anything in someone's own
// search). One noun for all of them, always on, because a listing lives on
// its own and is found by its labels. Messaging, reporting, and blocking
// stay with the person.

const ok = (message: string, data?: unknown): VerbResult => ({ ok: true, message, data });
const fail = (error: string): VerbResult => ({ ok: false, error });
const target = "the listing's id from Find";

const labels = (raw: unknown) =>
  String(raw ?? "")
    .split(",")
    .map((l) => normalizeLabel(l))
    .filter((l): l is string => Boolean(l))
    .slice(0, 10);

export const listingNoun: NounDef = {
  name: "Listing",
  dictionary: "core",
  alwaysOn: true,
  description:
    "One thing someone shares through a search: an idea (Idea Index), something for sale or free or a room (Marketplace), a job (Job Match), or whatever another search makes. Anyone signed in can find it by its labels.",
  notes:
    "To share one, name the search it goes in (Find with 'searches = yes' lists them and what each asks for). Write its words as 'Field: value' lines using that search's fields. " +
    "It's public to signed-in people right away, so read it back to the user and get a yes before Add. Only Edit, Done, Renew, or Delete the user's own.",
  verbs: {
    Add: {
      description: "Share a new listing through a search.",
      params: [
        { name: "search", type: "text", required: true, max: 80, description: "The search's name, like Idea Index or Marketplace." },
        { name: "name", type: "text", required: true, max: 80, description: "Short and plain: 'Charging lockers at the Cafe', 'Blue couch'." },
        { name: "text", type: "text", max: 6000, description: "'Field: value' lines using the search's fields." },
        { name: "labels", type: "text", max: 300, description: "Comma-separated extra labels. The search's own are added for you." },
      ],
      run: async ({ ctx, values }) => {
        const { data: searches } = await ctx.supabase.from("dictionaries").select("id, name, fields, noun").not("noun", "is", null).ilike("name", String(values.search));
        const search = searches?.[0];
        if (!search) return fail(`No search named "${values.search}". Find with searches = yes lists them.`);
        const fields = fieldsOf(search.fields);
        const { data, error } = await ctx.supabase.rpc("create_listing", {
          p_search: search.id,
          p_name: String(values.name),
          p_values: valuesFromText(fields, String(values.text ?? "")),
          p_labels: labels(values.labels),
          p_photos: [],
        });
        if (error) return fail(error.message);
        return ok(`Shared "${values.name}" in ${search.name}. Signed-in people can find it now. Add photos from the app.`, { id: data });
      },
    },
    Find: {
      description:
        "Listings carrying any of the labels, best match first, or only the user's own (mine = yes). With searches = yes, lists the searches that make listings and the fields each asks for.",
      params: [
        { name: "labels", type: "text", max: 200, description: "Comma-separated, like 'idea' or 'marketplace, free'." },
        { name: "query", type: "text", max: 100, description: "Words to match in names, fields, and labels." },
        { name: "mine", type: "enum", options: ["yes", "no"] },
        { name: "searches", type: "enum", options: ["yes", "no"] },
      ],
      run: async ({ ctx, values }) => {
        if (values.searches === "yes") {
          const { data } = await ctx.supabase.from("dictionaries").select("name, noun, fields, shows").not("noun", "is", null).order("name").limit(50);
          return ok(`${data?.length ?? 0} searches make listings.`, (data ?? []).map((s) => ({
            search: s.name,
            makes: s.noun,
            labels: s.shows,
            fields: fieldsOf(s.fields).map((f) => f.label),
          })));
        }
        const wanted = labels(values.labels);
        if (wanted.length === 0) return fail("Give at least one label, like idea or marketplace.");
        const { items, total } = await findLabeledDictionaries(ctx.supabase, wanted, ctx.userId, {
          query: String(values.query ?? ""),
          mine: values.mine === "yes",
        });
        return ok(`${total} found${total > items.length ? `, showing the first ${items.length}` : ""}.`, items.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          by: d.mine ? "you" : d.byName,
          summary: d.summary,
          labels: d.labels,
          sparks: d.sparks || undefined,
          done: d.done || undefined,
          ended: d.ended || undefined,
          new_messages: d.unread || undefined,
        })));
      },
    },
    Edit: {
      description: "Rename the user's listing or change its words. Fields not given stay as they are.",
      target,
      params: [
        { name: "name", type: "text", max: 80 },
        { name: "text", type: "text", max: 6000, description: "'Field: value' lines for the fields to change." },
      ],
      run: async ({ ctx, target: id, values }) => {
        const { data: d } = await ctx.supabase.from("dictionaries").select("name, fields, page, owner_user_id").eq("id", id!).eq("display_kind", "listing").maybeSingle();
        if (!d || d.owner_user_id !== ctx.userId) return fail("That isn't one of your listings. Find with mine = yes.");
        const merged = { ...(d.page ?? {}), ...valuesFromText(fieldsOf(d.fields), String(values.text ?? "")) };
        const { error } = await ctx.supabase.rpc("save_listing", { p_id: id, p_name: String(values.name ?? d.name), p_values: merged, p_photos: null });
        return error ? fail(error.message) : ok("Updated it.");
      },
    },
    Delete: {
      description: "Delete the user's listing for good. Ask first.",
      target,
      run: async ({ ctx, target: id }) => {
        const { error } = await ctx.supabase.rpc("delete_listing", { p_id: id });
        return error ? fail(error.message) : ok("Deleted it.");
      },
    },
  },
  actions: {
    Renew: {
      description: "Push the end date out on the user's listing.",
      target,
      run: async ({ ctx, target: id }) => {
        const { error } = await ctx.supabase.rpc("renew_listing", { p_id: id });
        return error ? fail(error.message) : ok("Renewed it.");
      },
    },
    Done: {
      description: "Mark the user's listing done (sold, given, filled, built), or open it again with open = yes.",
      target,
      params: [{ name: "open", type: "enum", options: ["yes", "no"] }],
      run: async ({ ctx, target: id, values }) => {
        const { error } = await ctx.supabase.rpc("set_listing_done", { p_id: id, p_done: values.open !== "yes" });
        return error ? fail(error.message) : ok(values.open === "yes" ? "Opened it again." : "Marked it done.");
      },
    },
  },
};
