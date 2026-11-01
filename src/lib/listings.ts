// Dictionary types, and listings: the small dictionaries a search makes
// (an idea, a couch, a job). Pure, safe to import from client and server.

import type { CustomField } from "@/lib/custom";

// What a dictionary is, by its display kind. Shown on cards so people know
// what they're opening.
export type DictionaryType = "Word list" | "Page" | "Listing" | "Search" | "App" | "Profile";

export function typeOf(displayKind: string, noun?: string | null): DictionaryType {
  if (displayKind === "listing") return "Listing";
  if (displayKind === "page") return "Page";
  if (displayKind === "profile") return "Profile";
  if (displayKind === "term_table") return "Word list";
  if (displayKind === "search" || noun) return "Search";
  return "App";
}

export type Listing = {
  id: string;
  name: string;
  values: Record<string, string>;
  fields: CustomField[];
  labels: string[];
  byName: string;
  createdAt: string;
  mine: boolean;
  optedIn: boolean;
};

// A dictionary that makes listings: its noun and shape.
export type Maker = { id: string; name: string; noun: string; fields: CustomField[] };

// The first words of a listing, for a card.
export function snippet(fields: CustomField[], values: Record<string, string>, max = 160): string {
  const text = fields.map((f) => values[f.key]).filter(Boolean).join(" · ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// "idea" → "an idea", "listing" → "a listing".
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

// The shape as the owner types it: "The problem (long), Price, When (date)".
export function shapeText(fields: CustomField[]): string {
  return fields.map((f) => (f.type === "text" ? f.label : `${f.label} (${f.type === "longtext" ? "long" : f.type})`)).join(", ");
}
