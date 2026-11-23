import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchEverything } from "@/lib/search";
import type { UiDirective } from "@/lib/sage-ui";
import { loadCopies, type DictionaryCopy, type VerbResult } from "./engine";

// The two tools that work the page itself: Search fills the rectangle with
// results, View (the "show" tool) puts a word, a dictionary's view, or a
// panel on the page.

const FIELD_PROPS = {
  word: { type: "string", description: "The word. For Search, a dictionary term or a title." },
  body: { type: "string", description: "The body. For Search, words that must all appear." },
  place: { type: "string", description: "A town, neighborhood, region, or country." },
  people: { type: "string", description: "A spark's name." },
  time: { type: "string", description: "day, week, month, year, decade, life, or a date like 2026-11-02 or 2026-11." },
  visibility: { type: "string", enum: ["private", "group", "public"] },
} as const;

export const PANELS = ["settings", "organizations", "new-notebook", "reports"] as const;

export function pageTools(viewNames: string[]): Anthropic.Tool[] {
  return [
    {
      name: "search",
      description:
        "Search: look through everything the user may see (dictionary words, their notes and journals, listings like ideas, jobs and things for sale, public profiles, organizations). Results fill the rectangle. Give only the fields the user named.",
      input_schema: { type: "object", properties: FIELD_PROPS },
    },
    {
      name: "show",
      description:
        'View: put something on the page. what="word" fills WORD, the rectangle, and Place/People/Time/Visibility. what="view" opens one of the user\'s dictionaries in the rectangle by name. what="panel" opens settings, organizations, new-notebook, or reports (moderators only). what="clear" goes back to the blank search form.',
      input_schema: {
        type: "object",
        properties: {
          what: { type: "string", enum: ["word", "view", "panel", "clear"] },
          ...FIELD_PROPS,
          view: { type: "string", description: `For what="view": the dictionary's name. Theirs now: ${viewNames.join(", ") || "none"}.` },
          panel: { type: "string", enum: [...PANELS] },
        },
        required: ["what"],
      },
    },
  ];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function short(name: string): string {
  return name.replace(/^.{1,40}?['’]s\s+/, "") || name;
}

export async function runPageTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { supabase: SupabaseClient; copies: DictionaryCopy[]; isModerator: boolean },
  emit: (d: UiDirective) => void,
): Promise<VerbResult> {
  const fields = {
    place: str(input.place) || undefined,
    people: str(input.people) || undefined,
    time: str(input.time) || undefined,
    visibility: str(input.visibility) || undefined,
  };

  if (name === "search") {
    const query = { word: str(input.word) || undefined, body: str(input.body) || undefined, ...fields };
    if (!Object.values(query).some(Boolean)) return { ok: false, error: "Give at least one thing to search for." };
    const items = await searchEverything(ctx.supabase, query);
    emit({ type: "results", query, items });
    return {
      ok: true,
      message: items.length === 0 ? "Nothing found." : `Found ${items.length}. They're on the page.`,
      data: items.slice(0, 5).map((i) => `${i.kind}: ${i.word}`),
    };
  }

  const what = str(input.what);
  if (what === "clear") {
    emit({ type: "clear" });
    return { ok: true, message: "Cleared." };
  }
  if (what === "word") {
    const word = str(input.word);
    if (!word) return { ok: false, error: 'what="word" needs a word.' };
    emit({ type: "word", word, body: typeof input.body === "string" ? input.body : "", ...fields });
    return { ok: true, message: `"${word}" is on the page.` };
  }
  if (what === "panel") {
    const panel = PANELS.find((p) => p === str(input.panel));
    if (!panel) return { ok: false, error: `panel must be one of: ${PANELS.join(", ")}.` };
    if (panel === "reports" && !ctx.isModerator) return { ok: false, error: "Reports are for moderators." };
    emit({ type: "panel", panel });
    return { ok: true, message: `Opened ${panel}.` };
  }
  if (what === "view") {
    const want = str(input.view).toLowerCase();
    if (!want) return { ok: false, error: 'what="view" needs view, a dictionary name.' };
    const find = (copies: DictionaryCopy[]) =>
      copies.find((c) => c.name.toLowerCase() === want || short(c.name).toLowerCase() === want) ??
      copies.find((c) => c.name.toLowerCase().includes(want) || c.address.toLowerCase().includes(want.replace(/\s+/g, "-")));
    // It may have just been turned on in this same reply.
    const match = find(ctx.copies) ?? find(await loadCopies(ctx.supabase));
    if (!match) {
      return { ok: false, error: `"${input.view}" isn't one of their dictionaries. Turn it on with add Dictionary first, then show it.` };
    }
    emit({ type: "view", id: match.id, name: short(match.name) });
    return { ok: true, message: `Opened ${short(match.name)}.` };
  }
  return { ok: false, error: 'what must be word, view, panel, or clear.' };
}
