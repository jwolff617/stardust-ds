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

export type Photo = { path: string; url: string };

export type Comment = { id: string; body: string; authorName: string; createdAt: string; mine: boolean; hidden: boolean };

export type Message = { id: string; body: string; senderName: string; createdAt: string; mine: boolean };

// One private thread: the maker and one other person.
export type Thread = { askerId: string; askerName: string; messages: Message[]; unread: number };

export type Listing = {
  id: string;
  name: string;
  values: Record<string, string>;
  fields: CustomField[];
  labels: string[];
  photos: Photo[];
  photoLimit: number;
  byName: string;
  createdAt: string;
  expiresAt: string | null;
  canRenew: boolean;
  done: boolean;
  hidden: boolean;
  sparks: number;
  sparked: boolean;
  mine: boolean;
  optedIn: boolean;
  isModerator: boolean;
  blocked: boolean;
  comments: Comment[];
  // The maker sees every thread; anyone else sees only their own.
  threads: Thread[];
};

// A dictionary that makes listings: its noun, shape, photos, and how long
// listings last.
export type Maker = { id: string; name: string; noun: string; fields: CustomField[]; photoLimit: number; lastsDays: number | null };

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: "scam", label: "Scam" },
  { key: "unsafe", label: "Unsafe" },
  { key: "unfair", label: "Unfair to someone" },
  { key: "spam", label: "Spam" },
  { key: "sexual", label: "Sexual" },
  { key: "other", label: "Something else" },
];

// "Ends in 12 days", "Ended", or null when it never ends.
export function endsText(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days <= 0) return "Ended";
  return days === 1 ? "Ends tomorrow" : `Ends in ${days} days`;
}

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

// How long a search's listings run, as offered in its settings.
export const LASTS_OPTIONS: { days: number | null; label: string }[] = [
  { days: null, label: "Until taken down" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
];
