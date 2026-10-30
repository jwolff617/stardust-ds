// Every board on Posts, by its dictionary address. The database holds each
// board's kinds and the switches its rules need (expiry, 18+, one per
// person, stewards only, open). This file holds what the app needs on top:
// each kind's money line and fields, and the words the UI uses. Kind names
// here must match post_kinds rows in the board's migration; kinds the
// database has but this file doesn't are left off the board.
//
// Every board reads the same way: the same tabs, the same buttons, the
// same words. A board only adds what it truly needs (photos, sparks, a
// manifesto's words).

export type BoardField = {
  key: string;
  label: string;
  // lines: a list of { word, text } picked from options (a manifesto).
  type: "text" | "longtext" | "choice" | "date" | "number" | "lines";
  options?: readonly string[];
  required?: boolean;
  // Most characters; for lines, most lines; for a number, the highest.
  max?: number;
  // For lines, fewest lines; for a number, the lowest.
  min?: number;
  placeholder?: string;
  help?: string;
};

export type BoardKind = {
  name: string;
  // The money line (price, pay, rent, cost), if the kind has one.
  price?: { label: string; required?: boolean; placeholder: string };
  fields: BoardField[];
  titlePlaceholder: string;
  bodyPlaceholder: string;
  // Kinds this one is matched against, by shared labels.
  matches?: string[];
  // The close button and its note to everyone who replied.
  close: { verb: string; done: string; note: string };
};

export type BoardConfig = {
  address: string;
  // What one post is called, for Sage AI.
  noun: string;
  nounDescription: string;
  kinds: BoardKind[];
  // Suggested while posting. Anyone can type their own.
  labels: string[];
  photos: number;
  // The board's safety notes, shown folded under the intro.
  safety: string[];
  // False keeps the board's noun out of Sage AI.
  sageAi?: boolean;
};

// The same close on every post board.
const DONE = { verb: "Mark done", done: "Done", note: "Thanks for writing. This one is done now." };

const SAFETY = [
  "Meet somewhere public the first time, in daylight.",
  "Stardust DS handles no money. Never pay before you've seen it in person.",
  "Report anything unsafe. Block anyone who makes you uneasy.",
];

export const MARKETPLACE: BoardConfig = {
  address: "marketplace-ds",
  noun: "Listing",
  nounDescription: "A Marketplace post: something for sale, something free, or a place to live. People pay each other in person; Stardust DS handles no money.",
  photos: 4,
  labels: ["furniture", "kids", "clothes", "bike", "tools", "kitchen", "books", "electronics", "phone", "baby", "outdoor", "pets", "art", "room", "apartment"],
  safety: SAFETY,
  kinds: [
    {
      name: "For Sale",
      price: { label: "Price", placeholder: "$40, or best offer" },
      fields: [],
      titlePlaceholder: "What it is: Kids' bike, 20 inch",
      bodyPlaceholder: "Details, and when you can meet.",
      close: DONE,
    },
    {
      name: "Free",
      fields: [],
      titlePlaceholder: "What it is: Winter coat, women's L",
      bodyPlaceholder: "Details, and where to pick it up.",
      close: DONE,
    },
    {
      name: "Housing",
      price: { label: "Rent", placeholder: "$850/mo" },
      fields: [],
      titlePlaceholder: "Room in a shared house, Lake City",
      bodyPlaceholder: "The place, and when you can show it.",
      close: DONE,
    },
  ],
};

export const JOB_MATCH: BoardConfig = {
  address: "job-match-ds",
  noun: "Job Post",
  nounDescription: "A Job Match post: a Job, or a Looking post from someone who wants work. Looking posts match jobs that share a label.",
  photos: 0,
  labels: ["kitchen", "cleaning", "warehouse", "retail", "childcare", "driving", "delivery", "construction", "landscaping", "events", "office", "healthcare", "remote"],
  safety: SAFETY,
  kinds: [
    {
      name: "Job",
      price: { label: "Pay", placeholder: "$21/hr" },
      fields: [],
      titlePlaceholder: "What the job is: Dishwasher, mornings",
      bodyPlaceholder: "The work, the hours, and how to apply.",
      matches: ["Looking"],
      close: DONE,
    },
    {
      name: "Looking",
      fields: [],
      titlePlaceholder: "Looking for kitchen work, mornings",
      bodyPlaceholder: "The work you want, when you can work, and what you've done.",
      matches: ["Job"],
      close: DONE,
    },
  ],
};

export const IDEA_INDEX: BoardConfig = {
  address: "idea-index-ds",
  noun: "Idea",
  nounDescription: "An Idea Index post: an idea that could be built. Others spark it, comment, and say I'm in.",
  photos: 0,
  labels: ["housing", "education", "transportation", "community", "food", "art", "music", "tech", "health", "environment", "business", "kids", "games"],
  safety: SAFETY,
  kinds: [
    {
      name: "Idea",
      fields: [],
      titlePlaceholder: "Charging lockers at the Cafe",
      bodyPlaceholder: "The idea, in a few lines.",
      close: { ...DONE, note: "" },
    },
  ],
};

// The words a manifesto picks from: Stardust Dictionary words first, then
// the prototype's (../manifesto-match).
export const MANIFESTO_WORDS = [
  "Love", "Presence", "Empathy", "Peace", "Freedom", "Community", "Family", "Forgiveness", "Imagination", "Nature",
  "Music", "Art", "Dream", "Purpose", "Passion", "Growth", "Balance", "Relax", "Stories", "Travel",
  "Sports", "Yes", "Focus", "Energy", "Spirit", "Soul", "Body", "Confidence", "Time", "Innocence",
  "Roots", "Risk", "Slowness", "Depth", "Wonder", "Loyalty", "Craft", "Solitude", "Tender", "Play",
  "Legacy", "Wild", "Honest", "Grounded", "Vision", "Simple", "Curious", "Home",
] as const;

const LINES: BoardField = {
  key: "lines",
  label: "Your words",
  type: "lines",
  options: MANIFESTO_WORDS,
  min: 5,
  max: 12,
  required: true,
};

const PAUSE = { verb: "Pause", done: "Paused", note: "" };

export const MANIFESTO_MATCH: BoardConfig = {
  address: "manifesto-match-ds",
  noun: "Manifesto",
  nounDescription: "Who a spark is in their own words, matched by shared words.",
  photos: 0,
  labels: [],
  // A manifesto is a person speaking for themselves.
  sageAi: false,
  safety: SAFETY,
  kinds: [
    {
      name: "Friends",
      fields: [LINES],
      titlePlaceholder: "A headline: Slow mornings, honest talk",
      bodyPlaceholder: "A few lines about you and the friend you hope to find.",
      close: PAUSE,
    },
    {
      name: "Business Partners",
      fields: [LINES],
      titlePlaceholder: "A headline: Builder looking for a money person",
      bodyPlaceholder: "A few lines about you and what you're building.",
      close: PAUSE,
    },
    {
      name: "Dating",
      fields: [
        LINES,
        { key: "age", label: "Age", type: "number", min: 18, max: 120, required: true },
        { key: "iam", label: "I am", type: "choice", options: ["A woman", "A man", "Nonbinary"], required: true },
        { key: "meet", label: "Hoping to meet", type: "choice", options: ["Women", "Men", "Everyone"], required: true },
        { key: "age_min", label: "Ages open to, from", type: "number", min: 18, max: 120, required: true },
        { key: "age_max", label: "Ages open to, up to", type: "number", min: 18, max: 120, required: true },
      ],
      titlePlaceholder: "A headline: Curious, rooted, still a kid at heart",
      bodyPlaceholder: "A few lines about you and who you hope to meet.",
      close: PAUSE,
    },
  ],
};

export const IDEA_HOUSE: BoardConfig = {
  address: "idea-house-ds",
  noun: "Application",
  nounDescription:
    "An application to the Idea House Fund: your idea, what you need (things, not cash), and how it helps. Only you and the fund's judges see it. Judges decide; Sage AI never does.",
  photos: 0,
  labels: [],
  safety: [
    "Your application is seen only by you and the fund's judges.",
    "The fund gives things, not cash, and never asks you for money or bank details.",
  ],
  kinds: [
    {
      name: "Application",
      price: { label: "About what it costs", placeholder: "About $300" },
      fields: [
        { key: "need", label: "What you need", type: "longtext", max: 1000, required: true, placeholder: "A vacuum and cleaning supplies." },
        { key: "helps", label: "How it helps", type: "longtext", max: 1000, required: true, placeholder: "I can take cleaning jobs and earn on my own schedule." },
      ],
      titlePlaceholder: "Your idea in one line: Start a house-cleaning business",
      bodyPlaceholder: "Anything else the judges should know.",
      close: { verb: "Withdraw", done: "Withdrawn", note: "" },
    },
  ],
};

export const BOARDS: BoardConfig[] = [MARKETPLACE, JOB_MATCH, IDEA_INDEX, MANIFESTO_MATCH, IDEA_HOUSE];

export function boardByAddress(address: string): BoardConfig | undefined {
  return BOARDS.find((b) => b.address === address);
}

export function kindOf(board: BoardConfig, name: string): BoardKind | undefined {
  return board.kinds.find((k) => k.name === name);
}

// Checks a kind's own fields. Returns clean details or an error a person
// (or Sage AI) can fix.
export function cleanDetails(kind: BoardKind, input: unknown): { details: Record<string, unknown> } | { error: string } {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const details: Record<string, unknown> = {};
  for (const f of kind.fields) {
    if (f.type === "lines") {
      const lines = cleanLines(f, raw[f.key]);
      if ("error" in lines) return lines;
      if (lines.lines.length > 0) details[f.key] = lines.lines;
      continue;
    }
    const value = String(raw[f.key] ?? "").trim().slice(0, f.type === "number" ? 12 : f.max ?? (f.type === "longtext" ? 2000 : 200));
    if (!value) {
      if (f.required) return { error: `${f.label} is needed for a ${kind.name} post.` };
      continue;
    }
    if (f.type === "choice") {
      const match = f.options?.find((o) => o.toLowerCase() === value.toLowerCase());
      if (!match) return { error: `${f.label} must be one of: ${f.options?.join(", ")}.` };
      details[f.key] = match;
    } else if (f.type === "number") {
      const n = Number(value);
      if (!Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
        return { error: `${f.label} must be a whole number${f.min !== undefined ? ` from ${f.min}` : ""}${f.max !== undefined ? ` to ${f.max}` : ""}.` };
      }
      details[f.key] = String(n);
    } else if (f.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `${f.label} must be a date like 2026-11-02.` };
      details[f.key] = value;
    } else {
      details[f.key] = value;
    }
  }
  return { details };
}

export type Line = { word: string; text: string };

// A manifesto's lines: words from the list, each with your own words for it.
function cleanLines(f: BoardField, raw: unknown): { lines: Line[] } | { error: string } {
  const list = Array.isArray(raw) ? raw : [];
  const lines: Line[] = [];
  for (const item of list) {
    const word = String((item as Line)?.word ?? "").trim();
    const match = f.options ? f.options.find((o) => o.toLowerCase() === word.toLowerCase()) : word.slice(0, 30);
    if (!match) return { error: `"${word}" isn't one of the words.` };
    if (lines.some((l) => l.word === match)) continue;
    lines.push({ word: match, text: String((item as Line)?.text ?? "").trim().slice(0, 280) });
  }
  const min = f.min ?? (f.required ? 1 : 0);
  if (lines.length < min) return { error: `Pick at least ${min} words for ${f.label}.` };
  if (f.max && lines.length > f.max) return { error: `Pick at most ${f.max} words for ${f.label}.` };
  return { lines };
}
