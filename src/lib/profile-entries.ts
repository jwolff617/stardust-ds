// Profile entries (0048): what a spark offers or seeks. Four kinds, each a
// word, a body, and Place, People, Visibility. Sage matches them by the
// words they share. Pure, safe to import from client and server.

export const ENTRY_KINDS = ["person", "idea", "job", "resource"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const SIDES = ["offer", "seek"] as const;
export type Side = (typeof SIDES)[number];
export const RELATIONSHIPS = ["romance", "friendship", "business"] as const;
export const DEALS = ["free", "sale", "trade"] as const;

export const KIND_LABELS: Record<EntryKind, string> = {
  person: "Person",
  idea: "Idea",
  job: "Job",
  resource: "Resource",
};

// What offer and seek mean for each kind, in plain words.
export const SIDE_LABELS: Record<EntryKind, Record<Side, string>> = {
  person: { offer: "Who I am", seek: "Who I hope to meet" },
  idea: { offer: "My idea", seek: "An idea I want to join" },
  job: { offer: "Hiring", seek: "Looking for work" },
  resource: { offer: "Have", seek: "Need" },
};

export type ProfileEntry = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  kind: EntryKind;
  side: Side;
  word: string;
  body: string;
  place: string;
  people: string;
  visibility: "private" | "public";
  details: Record<string, string>;
  paused: boolean;
  hidden: boolean;
  createdAt: string;
  mine: boolean;
};

export const ENTRY_COLUMNS =
  "id, owner_user_id, owner_name, kind, side, word, body, place, people, visibility, details, paused, hidden_at, created_at";

type Row = {
  id: string;
  owner_user_id: string;
  owner_name: string;
  kind: EntryKind;
  side: Side;
  word: string;
  body: string;
  place: string;
  people: string;
  visibility: "private" | "public";
  details: Record<string, unknown> | null;
  paused: boolean;
  hidden_at: string | null;
  created_at: string;
};

export function toEntry(r: Row, me: string | null): ProfileEntry {
  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.details ?? {})) if (v !== null && v !== undefined) details[k] = String(v);
  return {
    id: r.id,
    ownerUserId: r.owner_user_id,
    ownerName: r.owner_name || "A spark",
    kind: r.kind,
    side: r.side,
    word: r.word,
    body: r.body,
    place: r.place,
    people: r.people,
    visibility: r.visibility,
    details,
    paused: r.paused,
    hidden: Boolean(r.hidden_at),
    createdAt: r.created_at,
    mine: r.owner_user_id === me,
  };
}

// One short line of the kind's own details: "romance · 34", "pay $25/hr".
export function detailsLine(e: Pick<ProfileEntry, "kind" | "details">): string {
  const d = e.details;
  if (e.kind === "person") return [d.relationship, d.relationship === "romance" && d.age ? `${d.age}` : ""].filter(Boolean).join(" · ");
  if (e.kind === "job") return d.pay ? `pay ${d.pay}` : "";
  if (e.kind === "resource") return [d.deal, d.price].filter(Boolean).join(" · ");
  return "";
}

// Keeps only the detail keys a kind uses, as text.
export function cleanDetails(kind: EntryKind, raw: Record<string, unknown>): Record<string, string> {
  const keys: Record<EntryKind, string[]> = {
    person: ["relationship", "age", "iam", "meet", "age_min", "age_max"],
    idea: [],
    job: ["pay"],
    resource: ["deal", "price"],
  };
  const out: Record<string, string> = {};
  for (const k of keys[kind]) {
    const v = raw[k];
    if (v !== undefined && v !== null && String(v).trim()) out[k] = String(v).trim().toLowerCase().slice(0, 60);
  }
  if (out.price) out.price = String(raw.price).trim().slice(0, 60);
  if (out.pay) out.pay = String(raw.pay).trim().slice(0, 60);
  return out;
}
