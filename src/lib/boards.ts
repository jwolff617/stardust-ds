import type { WordingCheck } from "./wording";

// Every board on Posts, by its dictionary address. The database holds each
// board's kinds and the switches its rules need (expiry, 18+, one per
// person, stewards only, open). This file holds what the app needs on top:
// each kind's own fields, its money line, its wording check, and the words
// the UI uses. Kind names here must match post_kinds rows in the board's
// migration.

export type BoardField = {
  key: string;
  label: string;
  // lines: a list of { word, text } picked from options (a manifesto).
  type: "text" | "longtext" | "choice" | "date" | "lines";
  options?: readonly string[];
  required?: boolean;
  // Most characters, or for lines, most lines.
  max?: number;
  // For lines: fewest lines.
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
  // Checked before posting, with the rule explained.
  check?: WordingCheck;
  // Kinds this one is matched against for "For you".
  matches?: string[];
  // The close button and its note to everyone who replied.
  close: { verb: string; done: string; note: string };
};

export type BoardConfig = {
  address: string;
  // What one post is called, for buttons and Sage AI.
  noun: string;
  nounDescription: string;
  kinds: BoardKind[];
  // Suggested while posting. Anyone can type their own.
  labels: string[];
  photos: number;
  // The board's safety notes, shown folded under the intro.
  safety: string[];
  newPost: string;
  // False keeps the board's noun out of Sage AI.
  sageAi?: boolean;
};

const SOLD_NOTE = "Thanks for reaching out. This one's gone now.";

export const MARKETPLACE: BoardConfig = {
  address: "marketplace-ds",
  noun: "Listing",
  nounDescription:
    "A Marketplace post: something for sale, free, wanted, or to trade, or a room or place to live. Newest first. People pay each other in person; Stardust DS handles no money.",
  newPost: "New post",
  photos: 4,
  labels: ["furniture", "kids", "clothes", "coat", "bike", "tools", "kitchen", "books", "electronics", "phone", "baby", "outdoor", "garden", "pets", "art", "room", "apartment", "roommate"],
  safety: [
    "Meet in a busy public place in daylight, like a library branch or a store entrance. Bring a friend if you can.",
    "Look at it before you pay. Pay when it's in your hands. Stardust DS handles no money.",
    "Never send money to hold an item or a room. Never share a code sent to your phone. Never take extra money to send back.",
    "For housing: see the place inside and meet the person before any deposit.",
  ],
  kinds: [
    {
      name: "For Sale",
      price: { label: "Price", required: true, placeholder: "$40, or best offer" },
      fields: [{ key: "condition", label: "Condition", type: "choice", options: ["New", "Like new", "Good", "Fair", "For parts"] }],
      titlePlaceholder: "What it is: Kids' bike, 20 inch",
      bodyPlaceholder: "Size, age, anything wrong with it, when you can meet.",
      matches: ["Wanted"],
      close: { verb: "Mark sold", done: "Sold", note: SOLD_NOTE },
    },
    {
      name: "Free",
      fields: [
        { key: "pickup", label: "Pickup", type: "choice", options: ["Porch pickup", "Meet up", "I can drop off"] },
        {
          key: "choose",
          label: "How I'll choose",
          type: "choice",
          options: ["I'll wait a day and choose", "First to reply"],
          help: "Waiting a day is fair to people who check once a day.",
        },
      ],
      titlePlaceholder: "What it is: Winter coat, women's L",
      bodyPlaceholder: "Size, condition, where to pick up.",
      matches: ["Wanted"],
      close: { verb: "Mark given", done: "Given", note: "Thanks for asking. This one has gone to someone." },
    },
    {
      name: "Wanted",
      price: { label: "Budget", placeholder: "Free, or up to $50" },
      fields: [],
      titlePlaceholder: "What you need: Crib, or a phone charger",
      bodyPlaceholder: "What you need it for, and when.",
      matches: ["For Sale", "Free", "Trade"],
      close: { verb: "Mark found", done: "Found", note: "Thank you. I found one." },
    },
    {
      name: "Trade",
      fields: [{ key: "for", label: "Looking for in trade", type: "text", max: 120, placeholder: "A bike rack, or make an offer" }],
      titlePlaceholder: "What you have: Camping tent, 4 person",
      bodyPlaceholder: "Condition, and what you'd swap for.",
      matches: ["Wanted"],
      close: { verb: "Mark traded", done: "Traded", note: SOLD_NOTE },
    },
    {
      name: "Housing",
      price: { label: "Rent", required: true, placeholder: "$850/mo, utilities included" },
      fields: [
        { key: "side", label: "Offering or looking", type: "choice", options: ["Offering a place", "Looking for a place"], required: true },
        { key: "type", label: "Type", type: "choice", options: ["Room in a shared home", "Studio", "1 bedroom", "2+ bedrooms", "Other"] },
        { key: "move_in", label: "Move-in", type: "text", max: 40, placeholder: "Nov 15, or now" },
        { key: "included", label: "What's included", type: "text", max: 120, placeholder: "Utilities, laundry, parking" },
        { key: "step_free", label: "Step-free entry", type: "choice", options: ["Yes", "No", "Not sure"] },
      ],
      titlePlaceholder: "Room in a shared house, Lake City, near the 522",
      bodyPlaceholder: "The place, the house rules, the bus lines, when you can show it.",
      check: "housing",
      close: { verb: "Mark filled", done: "Filled", note: "Thanks for reaching out. The place is taken now." },
    },
  ],
};

const FILLED = { verb: "Mark filled", done: "Filled", note: "Thank you for applying. This one is filled now. We wish you the best, and we hope you'll look at our next one." };

export const JOB_MATCH: BoardConfig = {
  address: "job-match-ds",
  noun: "Job Post",
  nounDescription:
    "A Job Match post: a Job or Gig (both say what they pay), a Looking post from someone who wants work, or a Training. Looking matches jobs, gigs, and trainings that share a label.",
  newPost: "New post",
  photos: 0,
  labels: [
    "kitchen", "dishwasher", "cleaning", "janitorial", "warehouse", "retail", "childcare", "after-school", "driving", "delivery",
    "construction", "landscaping", "moving", "events", "security", "office", "healthcare", "outreach", "peer-support", "remote", "bus-line",
  ],
  safety: [
    "A real job never asks you to pay to start, buy equipment, or reship packages.",
    "Don't send your Social Security number or bank details in a message. Paperwork comes after you're hired, in person.",
    "Meet for an interview at the workplace or a public place in daylight.",
    "If something feels off, Report it. A steward will look.",
  ],
  kinds: [
    {
      name: "Job",
      price: { label: "Pay", required: true, placeholder: "$21 to $23/hr, or $48,000 a year" },
      fields: [
        { key: "hours", label: "Hours", type: "choice", options: ["Full time", "Part time", "Weekends only", "Seasonal"], required: true },
        { key: "schedule", label: "Schedule", type: "text", max: 120, placeholder: "Weekdays 2:15 to 6" },
        { key: "fair_chance", label: "Fair chance", type: "choice", options: ["People with records are welcome"], help: "Shows a Fair chance badge and filter." },
        { key: "experience", label: "Experience", type: "choice", options: ["None needed", "Some", "Experienced"] },
        { key: "apply", label: "How to apply", type: "choice", options: ["Message here", "In person", "Phone", "Online"], required: true },
        { key: "apply_where", label: "Where or how", type: "text", max: 200, placeholder: "An address and hours, a number, or a link" },
        { key: "answer", label: "We answer everyone", type: "choice", options: ["Within 3 days", "Within a week"], help: "A promise to everyone who applies." },
      ],
      titlePlaceholder: "What the job is: Dishwasher, mornings",
      bodyPlaceholder: "What the work is, where, what it needs (on your feet, lifting 30 lbs), and what you offer.",
      check: "hiring",
      matches: ["Looking"],
      close: FILLED,
    },
    {
      name: "Gig",
      price: { label: "Pay", required: true, placeholder: "$25/hr, or $80 for the job" },
      fields: [
        { key: "when", label: "When", type: "text", max: 120, required: true, placeholder: "Saturday Nov 8, 10am" },
        { key: "length", label: "About how long", type: "text", max: 60, placeholder: "3 hours" },
        { key: "bring", label: "What to bring", type: "text", max: 120, placeholder: "Gloves, work boots" },
      ],
      titlePlaceholder: "Help moving a couch, Wallingford",
      bodyPlaceholder: "What needs doing, and anything heavy or tricky about it.",
      check: "hiring",
      matches: ["Looking"],
      close: { verb: "Mark filled", done: "Filled", note: "Thanks for writing. I found someone for this one." },
    },
    {
      name: "Looking",
      fields: [
        { key: "work", label: "Work I'm looking for", type: "text", max: 160, required: true, placeholder: "Kitchen, dishwasher, prep cook" },
        { key: "available", label: "When I can work", type: "text", max: 120, placeholder: "Weekday mornings" },
        { key: "done", label: "What I've done", type: "longtext", max: 1000, placeholder: "Two years washing dishes. Food handler card." },
      ],
      titlePlaceholder: "Looking for kitchen work, mornings",
      bodyPlaceholder: "Anything else an employer should know. A first name and neighborhood is plenty; every signed-in spark can read this.",
      matches: ["Job", "Gig", "Training"],
      close: { verb: "Mark found", done: "Found work", note: "Thank you. I found work." },
    },
    {
      name: "Training",
      price: { label: "Cost", placeholder: "Free, with a $15/hr stipend" },
      fields: [
        { key: "when", label: "When", type: "text", max: 120, required: true, placeholder: "Starts Nov 17, weekdays 9 to 1" },
        { key: "length", label: "How long", type: "text", max: 60, placeholder: "6 weeks" },
        { key: "leaves_with", label: "You leave with", type: "text", max: 120, placeholder: "Food handler card, job interviews" },
        { key: "who", label: "Who it's for", type: "text", max: 160, placeholder: "Adults rebuilding after treatment or jail" },
      ],
      titlePlaceholder: "Free kitchen training with a stipend",
      bodyPlaceholder: "What you'll learn, where, and how to sign up.",
      matches: ["Looking"],
      close: { verb: "Mark full", done: "Full", note: "Thanks for asking. This session is full. Watch for the next one." },
    },
  ],
};

export const BOARDS: BoardConfig[] = [MARKETPLACE, JOB_MATCH];

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
    const value = String(raw[f.key] ?? "").trim().slice(0, f.max ?? (f.type === "longtext" ? 2000 : 200));
    if (!value) {
      if (f.required) return { error: `${f.label} is needed for a ${kind.name} post.` };
      continue;
    }
    if (f.type === "choice") {
      const match = f.options?.find((o) => o.toLowerCase() === value.toLowerCase());
      if (!match) return { error: `${f.label} must be one of: ${f.options?.join(", ")}.` };
      details[f.key] = match;
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

// All the words a wording check should read.
export function postText(post: { title: string; body: string; details: Record<string, unknown> }): string {
  const extra = Object.values(post.details).map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
  return [post.title, post.body, ...extra].join("\n");
}
