"use client";

import { useState } from "react";
import type { WordType } from "@/app/actions/words";

// The small pieces of the Stardust page: panels, labels, the type picker,
// the shortcut box.

export type ListWord = { id: string; word: string; kind: string; refId: string | null };

// What kind of word it is: a small, plain label.
export function TypePill({ type }: { type: string }) {
  // A list word not made yet has no type until it's created.
  if (type === "new") return null;
  const label = type === "organization" ? "org" : type === "new-notebook" ? "group" : type === "mine" ? "noun" : type;
  return <span className="shrink-0 text-xs text-[var(--muted)]">{label}</span>;
}

// What the open word is, in the word bar: VERB, NOUN, or THING and which.
const THING_OF: Record<string, string> = {
  note: "note",
  notes: "note",
  journal: "journal",
  idea: "idea",
  resource: "resource",
  organization: "org",
  org: "org",
  organizations: "org",
  person: "profile · person",
  job: "profile · job",
  profile: "profile",
  group: "group",
  "new-notebook": "group",
  inbox: "inbox",
  settings: "settings",
};

function kindLabel(t: string): { head: string; sub: string } {
  let type = t;
  // Making a word: it's whatever type is picked, same as once it's saved.
  if (type.startsWith("new:")) type = type.slice(4);
  if (type === "verb") return { head: "VERB", sub: "" };
  if (type === "noun" || type === "word" || type === "mine") return { head: "NOUN", sub: "" };
  if (type === "search") return { head: "SEARCH", sub: "results" };
  if (type === "reports") return { head: "REPORTS", sub: "" };
  const thing = THING_OF[type];
  return thing ? { head: "TOOL", sub: thing } : { head: type.toUpperCase(), sub: "" };
}

export function WordKind({ type }: { type: string }) {
  const { head, sub } = kindLabel(type);
  return (
    <span className="shrink-0 text-xs text-[var(--muted)]">
      <span className="font-medium text-[var(--foreground)]">{head.charAt(0) + head.slice(1).toLowerCase()}</span>
      {sub && <span className="text-[var(--muted)]"> · {sub}</span>}
    </span>
  );
}

// A bordered panel with a header bar, like the sketch.
export function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-[var(--line)] ${className}`}>
      <h2 className="px-3 pb-1 pt-2.5 text-xs font-medium text-[var(--muted)]">{title}</h2>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

export function WordListPanel({
  isLoggedIn,
  list,
  onOpen,
}: {
  isLoggedIn: boolean;
  list: { exists: boolean; words: ListWord[] };
  onOpen: (w: ListWord) => void;
}) {
  const empty = "text-sm text-[var(--muted)]";
  return (
    <Panel title="Today’s word list">
      {!isLoggedIn ? (
        <p className={empty}>Log in to keep a word list.</p>
      ) : !list.exists ? (
        <p className={empty}>No list yet. Tell Sage: new word list.</p>
      ) : list.words.length === 0 ? (
        <p className={empty}>Empty. Tell Sage: add to word list hope.</p>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {list.words.map((w) => (
            <li key={w.id} className="border-b border-[var(--line)] last:border-b-0">
              <button
                type="button"
                onClick={() => onOpen(w)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--soft)]"
              >
                <span className="truncate font-medium">{w.word}</span>
                <TypePill type={w.kind} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const VERBS = ["new", "edit", "search", "view", "match", "contact", "share", "delete", "remove"];
// Things, public first, then shared, then private. A thin line between
// the three; hover says which.
const THINGS: { who: string; words: string[] }[] = [
  { who: "Public", words: ["idea", "org", "profile", "resource"] },
  { who: "Shared", words: ["group", "inbox", "settings"] },
  { who: "Private", words: ["note", "journal", "my nouns"] },
];

const ITEM = "px-1.5 py-0.5 text-left text-sm hover:bg-[var(--soft)] hover:underline";

export function Verbs({ onVerb }: { onVerb: (text: string) => void }) {
  return (
    <Panel title="Verbs">
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-2">
        {VERBS.map((v) => (
          <button key={v} type="button" onClick={() => onVerb(v)} className={ITEM}>
            {v}
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function Things({ onThing }: { onThing: (thing: string) => void }) {
  return (
    <Panel title="Tools">
      <div className="-mx-3 flex flex-col">
        {THINGS.map((g) => (
          <div key={g.who} title={g.who} className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-b border-[var(--line)] px-3 py-1.5 last:border-b-0 sm:grid-cols-3 lg:grid-cols-2">
            {g.words.map((w) => (
              <button key={w} type="button" onClick={() => onThing(w)} title={`${w} · ${g.who.toLowerCase()}`} className={ITEM}>
                {w}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export const PANEL_TITLES: Record<string, string> = {
  settings: "Settings",
  organizations: "Organizations",
  reports: "Reports",
  "new-notebook": "New notebook",
  inbox: "Inbox",
  profile: "Profile",
  nouns: "My nouns",
};

// The types a new word can be. The type decides its card: a noun, org,
// idea, job, resource, or person is a word and a body (plus its details);
// notes, journal, and group make a notebook that works like one.
export const WORD_TYPES: { type: WordType; label: string; about: string }[] = [
  { type: "noun", label: "noun", about: "A word and what it means to you. Private." },
  { type: "org", label: "org", about: "A board: mission, announcements, contact. Public." },
  { type: "idea", label: "idea", about: "A journal anyone can read. Write entries over time." },
  { type: "job", label: "job", about: "On your profile: hiring, or looking for work. Public." },
  { type: "resource", label: "resource", about: "Something you have to lend or sell, or need. Public." },
  { type: "person", label: "person", about: "On your profile: who you are, or who you hope to meet. Public." },
  { type: "notes", label: "notes", about: "Short notes that live a day to a life. Private." },
  { type: "journal", label: "journal", about: "Entries over time. Private." },
  { type: "group", label: "group", about: "A shared notebook. Put members' emails in People." },
];

export function TypePicker({
  type,
  onType,
  details,
  onDetails,
}: {
  type: WordType;
  onType: (t: WordType) => void;
  details: Record<string, string>;
  onDetails: (d: Record<string, string>) => void;
}) {
  const set = (k: string) => (e: { target: { value: string } }) => onDetails({ ...details, [k]: e.target.value });
  const sel = "rounded border border-[var(--line)] bg-[var(--background)] px-2 py-1 text-sm";
  const about = WORD_TYPES.find((t) => t.type === type)?.about;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Word type">
        <span className="mr-1 text-xs text-[var(--muted)]">Type</span>
        {WORD_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            role="radio"
            aria-checked={type === t.type}
            onClick={() => onType(t.type)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              type === t.type ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--line)] hover:border-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {about && <p className="text-xs text-[var(--muted)]">{about}</p>}
      <div className="flex flex-wrap gap-2">
        {type === "org" && (
          <>
            <select value={details.kind ?? "other"} onChange={set("kind")} aria-label="Organization type" className={sel}>
              <option value="business">Business</option>
              <option value="government">Government</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="other">Other</option>
            </select>
            <input value={details.website ?? ""} onChange={set("website")} placeholder="Website" aria-label="Website" className={sel} />
          </>
        )}
        {(type === "job" || type === "resource" || type === "person") && (
          <select value={details.side ?? "offer"} onChange={set("side")} aria-label="Offer or seek" className={sel}>
            <option value="offer">{type === "person" ? "Who I am" : type === "job" ? "Hiring" : type === "resource" ? "Have" : "My idea"}</option>
            <option value="seek">{type === "person" ? "Who I hope to meet" : type === "job" ? "Looking for work" : type === "resource" ? "Need" : "An idea to join"}</option>
          </select>
        )}
        {type === "person" && (
          <select value={details.relationship ?? "friendship"} onChange={set("relationship")} aria-label="Relationship" className={sel}>
            <option value="friendship">Friendship</option>
            <option value="business">Business</option>
            <option value="romance" disabled>
              Romance (set up in Profile)
            </option>
          </select>
        )}
        {type === "job" && <input value={details.pay ?? ""} onChange={set("pay")} placeholder="Pay" aria-label="Pay" className={sel} />}
        {type === "resource" && (
          <>
            <select value={details.deal ?? ""} onChange={set("deal")} aria-label="Free, sale, or trade" className={sel}>
              <option value="">Free, sale, or trade?</option>
              <option value="free">Free</option>
              <option value="sale">For sale</option>
              <option value="trade">Trade</option>
            </select>
            {details.deal === "sale" && <input value={details.price ?? ""} onChange={set("price")} placeholder="Price" aria-label="Price" className={sel} />}
          </>
        )}
        {type === "group" && (
          <select value={details.style ?? "night"} onChange={set("style")} aria-label="Group writes" className={sel}>
            <option value="night">Shared notes</option>
            <option value="journal">Shared journal</option>
          </select>
        )}
      </div>
    </div>
  );
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </svg>
  );
}

// The # box: type a hotkey number (1 to 50) and Enter goes straight there.
export function HotkeyBox({ onGo }: { onGo: (n: string) => void }) {
  const [n, setN] = useState("");
  return (
    <label className="flex shrink-0 items-center gap-0.5 border-r border-[var(--line)] pl-1 pr-2 text-sm text-[var(--muted)]">
      #
      <input
        value={n}
        maxLength={5}
        onChange={(e) => setN(e.target.value.replace(/[^a-z0-9]/gi, "").toLowerCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && n) {
            e.preventDefault();
            // Numbers are hotkeys; letters are built-in codes or tickers.
            onGo(/^\d+$/.test(n) ? n : `#${n}`);
            setN("");
          }
        }}
        aria-label="Hotkey number"
        title="Shortcut: a hotkey number, or j journals, n notes, i ideas, o orgs, g groups, r resources, w nouns, p profile (pp pi pj pr), s settings, m inbox"
        className="w-11 bg-transparent text-[var(--foreground)] outline-none"
      />
    </label>
  );
}
