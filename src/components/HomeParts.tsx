"use client";

import { useState } from "react";
import type { MyNoun } from "@/lib/shortcuts";
import { CARD_COUNTS, HOTKEY_NUMBERS, type Hotkey } from "@/lib/preferences";
import { ToolIcon } from "./ToolIcon";

// The home screen's pieces: the Nav (My List, Recent), Tools, the search
// shortcuts, and the grid of cards.

const SIDE = "rounded-lg border border-[var(--line)]";
const HEAD = "flex items-center justify-between px-2.5 pb-1 pt-2 text-xs font-medium text-[var(--muted)]";
const ROW = "flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm hover:bg-[var(--soft)]";

export type Slot = { meaning: string; kind?: string; id?: string };

// A small hide/show icon for a side column.
export function HideButton({ side, hidden, onToggle }: { side: "left" | "right"; hidden: boolean; onToggle: () => void }) {
  const pointsLeft = (side === "left") !== hidden;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={hidden ? `Show ${side} menu` : `Hide ${side} menu`}
      title={hidden ? `Show ${side} menu` : `Hide ${side} menu`}
      className="rounded px-1 text-xs leading-none text-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {pointsLeft ? "‹" : "›"}
    </button>
  );
}

// Nav: My List (1 to 9, your hotkeys, the word list) or Recent.
export function NavPanel({
  slots,
  nouns,
  onOpenSlot,
  onSetSlot,
  onOpenNoun,
  onHide,
}: {
  slots: (Hotkey | undefined)[];
  nouns: MyNoun[];
  onOpenSlot: (n: string) => void;
  onSetSlot: (n: string, slot: Slot | null) => void;
  onOpenNoun: (n: MyNoun) => void;
  onHide: () => void;
}) {
  const [tab, setTab] = useState<"list" | "recent">("list");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const recent = nouns
    .filter((n) => n.lastOpened)
    .sort((a, b) => b.lastOpened!.localeCompare(a.lastOpened!))
    .slice(0, 9);

  function commit(n: string) {
    const text = draft.trim();
    setEditing(null);
    setDraft("");
    if (!text) return;
    const hit = nouns.find((x) => x.word.toLowerCase() === text.toLowerCase());
    onSetSlot(n, hit ? { meaning: hit.word, kind: hit.kind, id: hit.id } : { meaning: text });
  }

  return (
    <div className={SIDE}>
      <div className={HEAD}>
        <span className="flex gap-2">
          {(["list", "recent"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={tab === t ? "text-[var(--foreground)] underline" : "hover:text-[var(--foreground)]"}>
              {t === "list" ? "My List" : "Recent"}
            </button>
          ))}
        </span>
        <HideButton side="left" hidden={false} onToggle={onHide} />
      </div>
      <ol className="flex flex-col px-1.5 pb-2">
        {tab === "list"
          ? HOTKEY_NUMBERS.map((n, i) => {
              const s = slots[i];
              return (
                <li key={n} className="group flex items-center gap-1">
                  <span className="w-3 shrink-0 text-right text-xs text-[var(--muted)]">{n}</span>
                  {editing === n ? (
                    <>
                      <input
                        autoFocus
                        list="my-nouns-list"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(n)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit(n);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        aria-label={`Set ${n}`}
                        className="min-w-0 flex-1 border-b border-[var(--foreground)] bg-transparent px-1 py-0.5 text-sm outline-none"
                      />
                    </>
                  ) : s?.meaning ? (
                    <>
                      <button type="button" onClick={() => onOpenSlot(n)} className={ROW} title={s.meaning}>
                        <span className="truncate">{s.meaning}</span>
                      </button>
                      <button type="button" onClick={() => onSetSlot(n, null)} aria-label={`Clear ${n}`} className="px-0.5 text-xs text-[var(--muted)] opacity-0 hover:text-[var(--foreground)] group-hover:opacity-100 focus:opacity-100">
                        ×
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(n);
                        setDraft("");
                      }}
                      className={`${ROW} text-[var(--muted)] opacity-50`}
                    >
                      ·
                    </button>
                  )}
                </li>
              );
            })
          : recent.length === 0
            ? <li className="px-1 py-1 text-sm text-[var(--muted)]">Nothing opened yet.</li>
            : recent.map((r) => (
                <li key={`${r.kind}:${r.id}`}>
                  <button type="button" onClick={() => onOpenNoun(r)} className={ROW} title={r.word}>
                    <ToolIcon tool={r.thing} size={12} className="text-[var(--muted)]" />
                    <span className="truncate">{r.word}</span>
                  </button>
                </li>
              ))}
      </ol>
      <datalist id="my-nouns-list">
        {nouns.map((x) => (
          <option key={`${x.kind}:${x.id}`} value={x.word} />
        ))}
      </datalist>
    </div>
  );
}

// Tools, each with its letter for the # box.
export const TOOLS: { key: string; label: string; icon: string }[] = [
  { key: "j", label: "journal", icon: "journal" },
  { key: "n", label: "notes", icon: "note" },
  { key: "g", label: "groups", icon: "group" },
  { key: "i", label: "ideas", icon: "idea" },
  { key: "o", label: "orgs", icon: "org" },
  { key: "e", label: "events", icon: "event" },
  { key: "l", label: "idea profile", icon: "idea" },
  { key: "p", label: "person profile", icon: "profile" },
  { key: "r", label: "resource profile", icon: "resource" },
  { key: "m", label: "match", icon: "match" },
  { key: "b", label: "inbox", icon: "inbox" },
];

export function ToolsPanel({ onTool }: { onTool: (key: string) => void }) {
  return (
    <div className={SIDE}>
      <div className={HEAD}>Tools</div>
      <ul className="flex flex-col px-1.5 pb-2">
        {TOOLS.map((t) => (
          <li key={t.key}>
            <button type="button" onClick={() => onTool(t.key)} className={ROW} title={`#${t.key}`}>
              <span className="w-3 shrink-0 text-xs uppercase text-[var(--muted)]">{t.key}</span>
              <ToolIcon tool={t.icon} size={12} className="text-[var(--muted)]" />
              <span className="truncate">{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Search shortcuts: what people come to find.
const SEARCHES: { head: string; items: { label: string; ask: string }[] }[] = [
  { head: "Ideas", items: [{ label: "orgs", ask: "search orgs" }, { label: "profiles", ask: "match my idea profile" }] },
  { head: "People", items: [{ label: "dates", ask: "match my person profile for romance" }, { label: "friends", ask: "match my person profile for friendship" }] },
  { head: "Resources", items: [{ label: "jobs", ask: "match my resource profile for jobs" }, { label: "junk", ask: "match my resource profile for things" }] },
];

export function SearchPanel({ onAsk, onHide }: { onAsk: (text: string) => void; onHide: () => void }) {
  return (
    <div className={SIDE}>
      <div className={HEAD}>
        <HideButton side="right" hidden={false} onToggle={onHide} />
        <span>Search</span>
      </div>
      <div className="flex flex-col gap-1.5 px-1.5 pb-2">
        {SEARCHES.map((g) => (
          <div key={g.head}>
            <p className="px-1 text-sm font-medium">{g.head}</p>
            {g.items.map((it) => (
              <button key={it.label} type="button" onClick={() => onAsk(it.ask)} className={`${ROW} pl-3 text-[var(--muted)] hover:text-[var(--foreground)]`}>
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Columns for each card count, written out so Tailwind keeps them.
const COLS: Record<number, string> = {
  1: "grid-cols-1",
  4: "grid-cols-2",
  6: "grid-cols-2 sm:grid-cols-3",
  8: "grid-cols-2 sm:grid-cols-4",
  9: "grid-cols-2 sm:grid-cols-3",
  12: "grid-cols-2 sm:grid-cols-4",
  15: "grid-cols-2 sm:grid-cols-5",
  20: "grid-cols-2 sm:grid-cols-5",
};

export type Preview = { body: string; tool: string };

// The grid: your list in order, then empty workspaces. Clear one card to
// free its space (nothing is deleted); Clear all goes back to one card.
export function CardGrid({
  cards,
  count,
  previews,
  onCount,
  onOpen,
  onClearCard,
  onClearAll,
}: {
  cards: (Slot | null)[];
  count: number;
  previews: Record<string, Preview>;
  onCount: (n: number) => void;
  onOpen: (i: number) => void;
  onClearCard: (i: number) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex min-h-[45vh] flex-1 flex-col gap-2 rounded-lg border border-[var(--line)] p-3">
      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <label className="flex items-center gap-1">
          Cards
          <select value={count} onChange={(e) => onCount(Number(e.target.value))} aria-label="How many cards" className="bg-transparent text-[var(--foreground)] outline-none">
            {CARD_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onClearAll} className="underline hover:text-[var(--foreground)]">
          Clear all
        </button>
      </div>
      <div className={`grid flex-1 auto-rows-fr gap-2 ${COLS[count] ?? "grid-cols-3"}`}>
        {cards.map((c, i) => {
          const p = c?.kind && c.id ? previews[`${c.kind}:${c.id}`] : undefined;
          return (
            <div key={i} className="group relative flex min-h-24 min-w-0 flex-col rounded-md border border-[var(--line)] hover:border-[var(--foreground)]">
              <button type="button" onClick={() => onOpen(i)} className="flex min-w-0 flex-1 flex-col gap-1 p-2.5 text-left">
                {c ? (
                  <>
                    <span className="flex min-w-0 items-center gap-1.5 pr-4 text-sm font-semibold">
                      {p && <ToolIcon tool={p.tool} size={13} className="text-[var(--muted)]" />}
                      <span className="truncate">{c.meaning}</span>
                    </span>
                    {p?.body && <span className="line-clamp-4 whitespace-pre-wrap text-xs text-[var(--muted)]">{p.body}</span>}
                  </>
                ) : (
                  <span className="m-auto text-xs text-[var(--muted)] opacity-60">search or create</span>
                )}
              </button>
              {c && (
                <button
                  type="button"
                  onClick={() => onClearCard(i)}
                  aria-label="Clear this card"
                  title="Clear this card (nothing is deleted)"
                  className="absolute right-1 top-0.5 px-1 text-sm text-[var(--muted)] opacity-0 hover:text-[var(--foreground)] group-hover:opacity-100 focus:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
