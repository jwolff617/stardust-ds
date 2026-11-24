"use client";

import { useMemo, useState } from "react";
import type { MyNoun } from "@/lib/shortcuts";
import { Panel } from "./StardustParts";
import { ToolIcon } from "./ToolIcon";
import { visibilityOf } from "@/lib/visibility";

type Tab = "recent" | "top" | "starred";

function sorted(nouns: MyNoun[], by: Tab | "name" | "new"): MyNoun[] {
  const list = [...nouns];
  if (by === "recent") return list.filter((n) => n.lastOpened).sort((a, b) => b.lastOpened!.localeCompare(a.lastOpened!));
  if (by === "top") return list.filter((n) => n.opens > 0).sort((a, b) => b.opens - a.opens || a.word.localeCompare(b.word));
  if (by === "starred") return list.filter((n) => n.favorite).sort((a, b) => a.word.localeCompare(b.word));
  if (by === "new") return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return list.sort((a, b) => a.word.localeCompare(b.word));
}

function Star({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={on ? "Unstar" : "Star"}
      aria-pressed={on}
      className={`shrink-0 px-1 text-sm leading-none ${on ? "text-amber-500" : "text-[var(--line)] hover:text-[var(--muted)]"}`}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

function Row({ n, onOpen, onStar, showThing = true }: { n: MyNoun; onOpen: (n: MyNoun) => void; onStar: (n: MyNoun) => void; showThing?: boolean }) {
  return (
    <li className="flex items-center gap-1 border-b border-[var(--line)] last:border-b-0">
      <Star on={n.favorite} onToggle={() => onStar(n)} />
      <button type="button" onClick={() => onOpen(n)} className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 pr-1 text-left hover:underline">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm">
          <ToolIcon tool={n.thing} size={14} className="text-[var(--muted)]" />
          <span className="truncate">{n.word}</span>
          {n.hotkey && <span className="ml-1 text-xs text-[var(--muted)]">({n.hotkey})</span>}
        </span>
        {showThing && (
          <span className="shrink-0 text-xs text-[var(--muted)]">
            {n.thing} · {visibilityOf(n.kind === "mine" ? "mine" : n.thing)}
          </span>
        )}
      </button>
    </li>
  );
}

// The left box: ten of your nouns, by Recent, Top, or Starred.
export function MyNounsBox({ nouns, onOpen, onStar, onViewAll }: { nouns: MyNoun[]; onOpen: (n: MyNoun) => void; onStar: (n: MyNoun) => void; onViewAll: () => void }) {
  const [tab, setTab] = useState<Tab>("recent");
  const list = sorted(nouns, tab).slice(0, 10);
  const empty = { recent: "Nothing opened yet.", top: "Nothing opened yet.", starred: "Tap ☆ on a noun to star it." }[tab];
  return (
    <Panel title="My nouns">
      <div className="mb-1 flex gap-3 text-xs">
        {(["recent", "top", "starred"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={tab === t ? "font-medium underline" : "text-[var(--muted)] hover:text-[var(--foreground)]"}>
            {t === "recent" ? "Recent" : t === "top" ? "Top 10" : "Starred"}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-1 text-sm text-[var(--muted)]">{nouns.length === 0 ? "Make your first with Create." : empty}</p>
      ) : (
        <ul className="-mx-1 flex flex-col">
          {list.map((n) => (
            <Row key={`${n.kind}:${n.id}`} n={n} onOpen={onOpen} onStar={onStar} />
          ))}
        </ul>
      )}
      {nouns.length > 0 && (
        <button type="button" onClick={onViewAll} className="mt-1 text-xs text-[var(--muted)] underline hover:text-[var(--foreground)]">
          View all ({nouns.length})
        </button>
      )}
    </Panel>
  );
}

const THINGS = ["all", "journal", "idea", "notes", "group", "org", "resource", "noun"];

// The My Nouns thing: every noun, filtered and sorted.
export function MyNounsView({ nouns, onOpen, onStar }: { nouns: MyNoun[]; onOpen: (n: MyNoun) => void; onStar: (n: MyNoun) => void }) {
  const [q, setQ] = useState("");
  const [thing, setThing] = useState("all");
  const [by, setBy] = useState<"name" | "new" | "recent" | "top" | "starred">("name");
  const list = useMemo(() => {
    const words = q.toLowerCase().trim();
    const base = by === "recent" || by === "top" || by === "starred" ? sorted(nouns, by) : sorted(nouns, by);
    return base.filter((n) => (thing === "all" || n.thing === thing) && (!words || n.word.toLowerCase().includes(words)));
  }, [nouns, q, thing, by]);
  const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--line)] hover:border-[var(--foreground)]"}`;

  return (
    <div className="flex flex-col gap-3 pr-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name"
          aria-label="Filter your nouns"
          className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-sm outline-none focus:border-[var(--foreground)]"
        />
        <select value={by} onChange={(e) => setBy(e.target.value as typeof by)} aria-label="Sort" className="rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-1 text-sm">
          <option value="name">A to Z</option>
          <option value="new">Newest</option>
          <option value="recent">Recently opened</option>
          <option value="top">Most opened</option>
          <option value="starred">Starred</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {THINGS.map((t) => (
          <button key={t} type="button" onClick={() => setThing(t)} aria-pressed={thing === t} className={chip(thing === t)}>
            {t === "all" ? "All" : t === "org" ? "orgs" : t === "notes" ? "notes" : `${t}s`}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing here.</p>
      ) : (
        <ul className="flex flex-col">
          {list.map((n) => (
            <Row key={`${n.kind}:${n.id}`} n={n} onOpen={onOpen} onStar={onStar} />
          ))}
        </ul>
      )}
    </div>
  );
}
