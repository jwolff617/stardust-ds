"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ProfileFields } from "./ProfileFields";
import { NightNotes } from "./NightNotes";
import type { NightView } from "@/lib/preferences";
import { AccountsView } from "./AccountsView";
import { WorthyView } from "./WorthyView";
import { AfterSchoolView } from "./AfterSchoolView";
import { WolffieGamesView } from "./WolffieGamesView";
import { MarketplaceView } from "./MarketplaceView";
import { JobsView } from "./JobsView";
import { IdeasView } from "./IdeasView";
import { LockersView } from "./LockersView";
import { LockersAdminView } from "./LockersAdminView";
import { BasicsView } from "./BasicsView";
import { NotepadView } from "./NotepadView";
import { BASIC_APPS, basicApp } from "@/lib/basics";
import type { Preferences } from "@/lib/preferences";

type SelectedDictionary = { id: string; name: string; displayKind: string; belongs: "personal" | "group" | "public" };
type PartOfSpeech = "verb" | "noun" | "more";
type DefinitionRow = {
  id: string;
  term: string;
  body: string;
  partOfSpeech: PartOfSpeech;
  dictionaryId: string;
  dictionaryName: string;
};

const TABS: { key: PartOfSpeech; label: string }[] = [
  { key: "verb", label: "Verbs" },
  { key: "noun", label: "Nouns" },
  { key: "more", label: "More" },
];

// Display kinds that have their own Display View.
const DISPLAY_KINDS = ["profile", "notes_list", "accounts", "worthy", "after_school", "lockers", "lockers_admin", "wolffie_games", "marketplace", "jobs", "ideas", ...BASIC_APPS.map((a) => a.kind)];

const hasDisplayView = (d: SelectedDictionary) => DISPLAY_KINDS.includes(d.displayKind);

// Your dictionaries in your order. Ones not placed yet (newly added) go
// at the bottom, in the order they came.
function inOrder(dictionaries: SelectedDictionary[], order: string[]): SelectedDictionary[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return dictionaries
    .map((d, i) => ({ d, r: rank.get(d.id) ?? order.length + i }))
    .sort((a, b) => a.r - b.r)
    .map(({ d }) => d);
}

// One dictionary's Display View in the feed.
function DisplayFor({
  d,
  reloadKey,
  night,
  onNightChange,
}: {
  d: SelectedDictionary;
  reloadKey: number;
  night: NightView;
  onNightChange: (view: NightView) => void;
}) {
  const dictionary = { id: d.id, name: d.name };
  switch (d.displayKind) {
    case "notes_list":
      return <NightNotes dictionaries={[dictionary]} reloadKey={reloadKey} view={night} onViewChange={onNightChange} />;
    case "profile":
      return <ProfileFields dictionaries={[dictionary]} reloadKey={reloadKey} />;
    case "accounts":
      return <AccountsView dictionary={dictionary} reloadKey={reloadKey} />;
    case "worthy":
      return <WorthyView dictionary={dictionary} reloadKey={reloadKey} />;
    case "after_school":
      return <AfterSchoolView dictionary={dictionary} reloadKey={reloadKey} />;
    case "lockers":
      return <LockersView reloadKey={reloadKey} />;
    case "lockers_admin":
      return <LockersAdminView dictionary={dictionary} reloadKey={reloadKey} />;
    case "notepad":
      return <NotepadView dictionary={dictionary} reloadKey={reloadKey} />;
    case "marketplace":
      return <MarketplaceView dictionary={dictionary} reloadKey={reloadKey} />;
    case "jobs":
      return <JobsView dictionary={dictionary} reloadKey={reloadKey} />;
    case "ideas":
      return <IdeasView dictionary={dictionary} reloadKey={reloadKey} />;
    case "wolffie_games":
      return <WolffieGamesView dictionary={dictionary} reloadKey={reloadKey} />;
    default: {
      const app = basicApp(d.displayKind);
      return app ? <BasicsView app={app} dictionary={dictionary} reloadKey={reloadKey} /> : null;
    }
  }
}

export function Module2Definitions({
  dictionaries: incoming,
  reloadKey = 0,
  onRefresh,
  prefs,
  onPrefsChange,
}: {
  dictionaries: SelectedDictionary[];
  reloadKey?: number;
  onRefresh?: () => void;
  prefs: NonNullable<Preferences["module2"]>;
  onPrefsChange: (change: (prev: NonNullable<Preferences["module2"]>) => NonNullable<Preferences["module2"]>) => void;
}) {
  // Everything opted-in is active by default; prefs track what's unchecked
  // so newly opted-in dictionaries show up active.
  const deselectedIds = prefs.deselectedIds ?? [];
  const activeTabs = prefs.activeTabs ?? ["verb", "noun", "more"];
  const dictionaries = inOrder(incoming, prefs.order ?? []);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DefinitionRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, startLoading] = useTransition();
  const pendingJump = useRef<string | null>(null);

  const activeDictionaryIds = dictionaries
    .map((d) => d.id)
    .filter((id) => !deselectedIds.includes(id));

  const displayable = dictionaries.filter((d) => hasDisplayView(d) && !deselectedIds.includes(d.id));
  const hasDisplay = displayable.length > 0;

  // The view you last picked wins. Until you pick one, Display View is the
  // landing view when a dictionary other than the always-on profiles has one.
  const prefersDisplay = displayable.some((d) => d.displayKind !== "profile");
  const listCollapsed = prefs.listCollapsed ?? false;
  const [dragging, setDragging] = useState<string | null>(null);
  const viewMode = prefs.viewMode ?? (prefersDisplay ? "display" : "term");
  const setViewMode = (mode: "term" | "display") => onPrefsChange((p) => ({ ...p, viewMode: mode }));

  // Reset to page 1 whenever the effective filter changes.
  const filterKey = `${activeDictionaryIds.join(",")}|${activeTabs.join(",")}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const noFilters = activeDictionaryIds.length === 0 || activeTabs.length === 0;
  const showDisplay = viewMode === "display" && hasDisplay;

  useEffect(() => {
    if (showDisplay || noFilters) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      dictionaryIds: activeDictionaryIds.join(","),
      pos: activeTabs.join(","),
      page: String(page),
    });

    startLoading(async () => {
      try {
        const res = await fetch(`/api/definitions?${params}`, { signal: controller.signal });
        const data = await res.json();
        setRows(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setRows([]);
      }
    });

    return () => controller.abort();
    // activeDictionaryIds/activeTabs are fresh arrays every render; their
    // joined strings are the stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDisplay, activeDictionaryIds.join(","), activeTabs.join(","), page, noFilters, reloadKey]);

  // After a jump is asked for, scroll once its block is on the page (it may
  // take a render to turn on or switch to Display View).
  useEffect(() => {
    const el = pendingJump.current && document.getElementById(`feed-${pendingJump.current}`);
    if (!el) return;
    pendingJump.current = null;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const setDeselectedIds = (change: (prev: string[]) => string[]) =>
    onPrefsChange((p) => ({ ...p, deselectedIds: change(p.deselectedIds ?? []) }));

  function toggleDictionaryFilter(id: string) {
    setDeselectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleTab(tab: PartOfSpeech) {
    onPrefsChange((p) => {
      const prev = p.activeTabs ?? ["verb", "noun", "more"];
      return { ...p, activeTabs: prev.includes(tab) ? prev.filter((x) => x !== tab) : [...prev, tab] };
    });
  }

  // Moves a dictionary to a new place in the feed: by the arrows, or by
  // dragging it onto another name (mouse only; phones use the arrows).
  function moveTo(id: string, j: number) {
    const ids = dictionaries.map((d) => d.id);
    const i = ids.indexOf(id);
    if (i < 0 || j < 0 || j >= ids.length || i === j) return;
    ids.splice(i, 1);
    ids.splice(j, 0, id);
    // Keep places for dictionaries that are off right now.
    const rest = (prefs.order ?? []).filter((x) => !ids.includes(x));
    onPrefsChange((p) => ({ ...p, order: [...ids, ...rest] }));
  }

  // Clicking a name turns it on if it's off and jumps to its Display View.
  function jumpTo(d: SelectedDictionary) {
    if (deselectedIds.includes(d.id)) setDeselectedIds((prev) => prev.filter((x) => x !== d.id));
    if (!hasDisplayView(d)) return;
    if (viewMode !== "display") setViewMode("display");
    pendingJump.current = d.id;
    // Already showing: nothing re-renders, so scroll now.
    document.getElementById(`feed-${d.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (dictionaries.length === 0) {
    return (
      <section className="flex flex-col gap-2 px-6 py-6">
        <RefreshButton onRefresh={onRefresh} />
        <p className="text-sm text-neutral-400">
          Turn on a dictionary above to see its words.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-6 sm:px-6">
      <RefreshButton onRefresh={onRefresh} />
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <aside className="flex w-full shrink-0 flex-col gap-1 self-start sm:sticky sm:top-2 sm:max-h-[calc(100vh-1rem)] sm:w-48 sm:overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            {/* Phones only: fold the list away so the feed gets the full width. */}
            <button
              type="button"
              onClick={() => onPrefsChange((p) => ({ ...p, listCollapsed: !listCollapsed }))}
              aria-expanded={!listCollapsed}
              className="text-xs font-medium text-neutral-500 sm:hidden"
            >
              {listCollapsed ? `▸ Dictionaries (${dictionaries.length})` : "▾ Dictionaries"}
            </button>
            <h3 className="hidden text-xs font-medium text-neutral-500 sm:block">Dictionaries</h3>
            <button
              type="button"
              className="text-xs underline"
              onClick={() =>
                setDeselectedIds((prev) =>
                  prev.length === 0 ? dictionaries.map((d) => d.id) : [],
                )
              }
            >
              {deselectedIds.length === 0 ? "None" : "All"}
            </button>
          </div>
          <div className={listCollapsed ? "hidden sm:flex sm:flex-col sm:gap-1" : "flex flex-col gap-1"}>
          {dictionaries.map((d, i) => (
            <div
              key={d.id}
              draggable
              onDragStart={(e) => {
                setDragging(d.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => dragging && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) moveTo(dragging, i);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
              className={`group flex cursor-grab items-center gap-1.5 text-sm ${dragging === d.id ? "opacity-40" : ""}`}
            >
              <input
                type="checkbox"
                checked={!deselectedIds.includes(d.id)}
                onChange={() => toggleDictionaryFilter(d.id)}
                aria-label={`Show ${d.name}`}
              />
              <button
                type="button"
                onClick={() => jumpTo(d)}
                title={`${d.name}${d.belongs === "group" ? " (group)" : d.belongs === "public" ? " (public)" : ""}`}
                className={`min-w-0 flex-1 truncate text-left ${hasDisplayView(d) ? "hover:underline" : "cursor-default"}`}
              >
                {d.name}
                {d.belongs !== "personal" && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-neutral-400">{d.belongs}</span>
                )}
              </button>
              <span className="flex shrink-0 text-xs text-neutral-400">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveTo(d.id, i - 1)}
                  aria-label={`Move ${d.name} up`}
                  className="px-0.5 hover:text-neutral-900 disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={i === dictionaries.length - 1}
                  onClick={() => moveTo(d.id, i + 1)}
                  aria-label={`Move ${d.name} down`}
                  className="px-0.5 hover:text-neutral-900 disabled:opacity-20"
                >
                  ▼
                </button>
              </span>
            </div>
          ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {hasDisplay && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("term")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  viewMode === "term"
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-600"
                }`}
              >
                Term View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("display")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  viewMode === "display"
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-600"
                }`}
              >
                Display View
              </button>
            </div>
          )}

          {!showDisplay ? (
            <>
              <div className="flex items-center gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => toggleTab(tab.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activeTabs.includes(tab.key)
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-300 text-neutral-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {noFilters ? (
                <p className="text-sm text-neutral-400">
                  Select at least one dictionary and one tab.
                </p>
              ) : isLoading ? (
                <p className="text-sm text-neutral-400">Loading...</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-neutral-400">No definitions match.</p>
              ) : (
                <table className="w-full table-fixed text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                      <th className="w-40 py-2 pr-4">Word</th>
                      <th className="py-2">Definition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 align-top">
                        <td className="py-2 pr-4 font-medium">
                          {row.term}
                          <span className="block text-xs text-neutral-400">{row.dictionaryName}</span>
                        </td>
                        <td className="py-2 text-neutral-700">{row.body}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-neutral-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-8">
              {displayable.map((d) => (
                <div key={d.id} id={`feed-${d.id}`} className="scroll-mt-4">
                  <DisplayFor
                    d={d}
                    reloadKey={reloadKey}
                    night={prefs.night ?? {}}
                    onNightChange={(view) => onPrefsChange((p) => ({ ...p, night: view }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RefreshButton({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600"
      >
        ↻ Refresh
      </button>
    </div>
  );
}
