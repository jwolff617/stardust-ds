import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL_CAPABLE } from "@/lib/anthropic";
import { COLORING, CUTOUTS, type Activity, type PacketContent } from "./shared";

// One Wolffie Games daily packet. The AI writes the words; the cut-out,
// coloring page, and word search grid are drawn by printables.js, so every
// printed page is ours and never a copied image.

export function cleanThemes(input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = String(raw ?? "").trim().slice(0, 60);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.slice(0, 5);
}

const activity = (extra: Record<string, unknown> = {}) => ({
  type: "object",
  properties: {
    title: { type: "string" },
    need: { type: "array", items: { type: "string" }, description: "Supplies with exact counts for the whole group. [\"Nothing\"] if none." },
    steps: { type: "array", items: { type: "string" }, description: "3 to 6 short steps a new staff member can read aloud." },
    tip: { type: "string", description: "One line: an easier or harder version, or what to watch for." },
    ...extra,
  },
  required: ["title", "need", "steps", "tip", ...Object.keys(extra)],
});

const qa = { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] };

const TOOL: Anthropic.Tool = {
  name: "write_packet",
  description: "Writes one day's Wolffie Games packet.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "The day's name, like \"Space Day\"." },
      craft: activity(),
      joke: qa,
      riddle: qa,
      game: activity({ where: { type: "string", enum: ["indoor", "outdoor", "either"] } }),
      cutout: activity({
        template: { type: "string", enum: [...CUTOUTS], description: "The printed template the kids cut out." },
        badgeLabel: { type: "string", description: "For badge only: 1 to 3 words printed on each badge. Empty otherwise." },
      }),
      coloring: {
        type: "object",
        properties: {
          template: { type: "string", enum: [...COLORING] },
          title: { type: "string", description: "A themed title for the page." },
          how: { type: "string", description: "One line of instructions, tied to the theme." },
        },
        required: ["template", "title", "how"],
      },
      wordsearch: {
        type: "object",
        properties: {
          title: { type: "string" },
          words: { type: "array", items: { type: "string" }, description: "Theme words, letters only, no spaces." },
        },
        required: ["title", "words"],
      },
      fact: { type: "string", description: "One true, surprising fact about the theme, in one or two sentences." },
    },
    required: ["title", "craft", "joke", "riddle", "game", "cutout", "coloring", "wordsearch", "fact"],
  },
};

function systemPrompt(kids: number, age: number) {
  const words = age <= 5 ? "6 words of 3 to 5 letters" : age <= 7 ? "8 words of up to 8 letters" : "10 words of up to 10 letters";
  return `You write Wolffie Games daily packets for after-school staff: quick, cheap, fun.
The group is ${kids} kids, about age ${age}.

Rules:
- Every item takes 5 minutes or less to prep, using what an after-school room already has: paper, crayons, scissors, tape, glue sticks, paper plates, cups, string, a ball, cones.
- Write supply counts for all ${kids} kids, plus a few spares.
- Craft: a simple 5-minute themed craft.
- Game: a Playworks-style game, written in our own words, sized for ${kids} kids (split into teams when it helps). No equipment that a program wouldn't have.
- Cut-out: pick the printed template (helicopter = paper spinner, bracelet = strip to decorate and tie, badge = round badge with a label) that fits the theme best, and write themed steps for it.
- Coloring page: pick a template. Mandala fits any theme. Write a themed title and one line tying it to the theme.
- Word search: ${words}, all tied to the theme.
- Joke and riddle: clean, actually funny to a ${age}-year-old, tied to the theme.
- Fact: true. If you are not sure it is true, pick another.
- Plain words a ${age}-year-old and a new staff member both understand. No brand names, no trademarked characters, no copied songs or lyrics.
- If there are several themes, blend them into one day.`;
}

export async function generatePacket(themes: string[], kids: number, age: number): Promise<PacketContent> {
  const response = await anthropic.messages.create({
    model: MODEL_CAPABLE,
    max_tokens: 4000,
    system: systemPrompt(kids, age),
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: `Theme: ${themes.join(" + ")}` }],
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Sage AI didn't write a packet. Try again.");
  return cleanContent(block.input);
}

const str = (v: unknown, max = 600) => String(v ?? "").trim().slice(0, max);
const strs = (v: unknown, n = 10, max = 300) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T => (options.includes(v as T) ? (v as T) : options[0]);

function cleanActivity(v: unknown): Activity {
  const a = (v ?? {}) as Record<string, unknown>;
  return { title: str(a.title, 100), need: strs(a.need), steps: strs(a.steps, 8), tip: str(a.tip) };
}

// Trust nothing from the model's output: keep the known fields, cut lengths.
export function cleanContent(input: unknown): PacketContent {
  const c = (input ?? {}) as Record<string, Record<string, unknown>>;
  const pair = (v: Record<string, unknown> | undefined) => ({ q: str(v?.q, 300), a: str(v?.a, 300) });
  return {
    title: str(c.title, 80) || "Today",
    craft: cleanActivity(c.craft),
    joke: pair(c.joke),
    riddle: pair(c.riddle),
    game: { ...cleanActivity(c.game), where: str(c.game?.where, 20) },
    cutout: {
      ...cleanActivity(c.cutout),
      template: oneOf(c.cutout?.template, CUTOUTS),
      badgeLabel: str(c.cutout?.badgeLabel, 24),
    },
    coloring: { template: oneOf(c.coloring?.template, COLORING), title: str(c.coloring?.title, 80), how: str(c.coloring?.how, 200) },
    wordsearch: {
      title: str(c.wordsearch?.title, 60),
      words: strs(c.wordsearch?.words, 12, 20)
        .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ""))
        .filter((w) => w.length >= 2),
    },
    fact: str(c.fact),
    // Picks this packet's mandala and word search layout, so reprints match.
    seed: Math.floor(Math.random() * 100000) + 1,
  };
}
