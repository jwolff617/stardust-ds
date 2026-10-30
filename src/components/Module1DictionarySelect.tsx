"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createGroup, toggleDictionary } from "@/app/actions/dictionaries";

type Instance = { id: string; name: string; displayKind: string };

type Dictionary = {
  id: string;
  address: string;
  name: string;
  description: string | null;
  kind: string;
  scope: string;
  locked: boolean;
  default_opt_in: boolean;
  instance: Instance | null;
  optedIn: boolean;
  labelTargetId: string | null;
  labels: string[];
  ownLabels: string[];
  isOtherProfile: boolean;
  displayKind: string;
};

// Who a dictionary belongs to, so the lists can say so:
// personal (your own copy), group (shared with members), or public.
export type Belongs = "personal" | "group" | "public";
export type SelectedDictionary = { id: string; name: string; displayKind: string; belongs: Belongs };

function belongsOf(d: { scope: string }): Belongs {
  return d.scope === "personal" ? "personal" : d.scope === "group" ? "group" : "public";
}

const BELONGS_TITLES: Record<Belongs, string> = { personal: "Mine", group: "Groups", public: "Public" };

// Your copy of a template is stored as "Peacemaker's Notes". Everything
// in your list is already yours, so the app shows just "Notes".
function shortName(name: string): string {
  return name.replace(/^.{1,40}?['’]s\s+/, "") || name;
}

export function Module1DictionarySelect({
  isLoggedIn,
  onSelectionChange,
  reloadKey = 0,
  onChange,
  storeHidden = false,
  collapsed = false,
  onCollapsedChange,
  onStoreHiddenChange,
  onCreateOwn,
}: {
  isLoggedIn: boolean;
  onSelectionChange?: (dictionaries: SelectedDictionary[]) => void;
  reloadKey?: number;
  onChange?: () => void;
  storeHidden?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onStoreHiddenChange?: (hidden: boolean) => void;
  // Opens Sage AI with a starting prompt for building a dictionary.
  onCreateOwn?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [allLabels, setAllLabels] = useState(false);
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isToggling, startToggle] = useTransition();

  const runSearch = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch(`/api/dictionaries/search?q=${encodeURIComponent(query)}`, { signal });
      const data = await res.json();
      setDictionaries(data.dictionaries ?? []);
    },
    [query],
  );

  useEffect(() => {
    const controller = new AbortController();

    startSearch(async () => {
      try {
        await runSearch(controller.signal);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Couldn't load dictionaries.");
      }
    });

    return () => controller.abort();
  }, [runSearch, reloadKey]);

  useEffect(() => {
    onSelectionChange?.(
      dictionaries
        .filter((d) => d.optedIn)
        .map((d) =>
          d.instance
            ? { id: d.instance.id, name: shortName(d.instance.name), displayKind: d.instance.displayKind, belongs: belongsOf(d) }
            : { id: d.id, name: d.name, displayKind: d.displayKind, belongs: belongsOf(d) },
        ),
    );
  }, [dictionaries, onSelectionChange]);

  function handleToggle(dictionary: Dictionary) {
    if (dictionary.locked) return;

    if (!isLoggedIn) {
      setError("Log in to add or remove dictionaries.");
      return;
    }

    // The first time, a group template asks for a name (members see it).
    // After that it toggles your copy on and off, same as Night DS.
    if (dictionary.kind === "instance_template" && dictionary.scope === "group" && !dictionary.instance) {
      const name = window.prompt(`Name your ${dictionary.name} group (for example, your site):`);
      if (!name?.trim()) return;
      setError(null);
      startToggle(async () => {
        try {
          await createGroup(dictionary.id, name);
          await runSearch();
          onChange?.();
        } catch (err) {
          setError((err as Error).message || "Couldn't make that group.");
        }
      });
      return;
    }

    const nextOptedIn = !dictionary.optedIn;
    setDictionaries((prev) =>
      prev.map((d) => (d.id === dictionary.id ? { ...d, optedIn: nextOptedIn } : d)),
    );

    startToggle(async () => {
      try {
        await toggleDictionary(dictionary.id, nextOptedIn);
        // Opting into a template resolves/creates the caller's own instance --
        // refetch so we pick up its id/name instead of just the local flag.
        if (dictionary.kind === "instance_template") {
          await runSearch();
        }
        onChange?.();
      } catch {
        setDictionaries((prev) =>
          prev.map((d) => (d.id === dictionary.id ? { ...d, optedIn: !nextOptedIn } : d)),
        );
        setError("Couldn't update that dictionary. Try again.");
      }
    });
  }

  // Your dictionaries (on) as chips, then the library (everything you
  // haven't added), which can be hidden and filtered by label. In code and
  // saved preferences the library is still called the store. Search
  // matches names, descriptions, and labels in both.
  const mine = dictionaries.filter((d) => d.optedIn);
  const store = dictionaries.filter((d) => !d.optedIn);
  const shownStore = label ? store.filter((d) => labelsOf(d).includes(label)) : store;

  // Library labels, most-used first, shown once there are enough
  // dictionaries for filtering to help. A dozen show; the rest wait behind More.
  const counts = new Map<string, number>();
  for (const d of store) for (const l of labelsOf(d)) counts.set(l, (counts.get(l) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
  const suggestions = allLabels ? ranked : ranked.slice(0, LABELS_SHOWN);
  if (label && !suggestions.includes(label)) suggestions.unshift(label);
  const showLabels = store.length >= LABELS_FROM || label !== null;

  const chip = (d: Dictionary) => (
    <li key={d.id}>
      <button
        type="button"
        disabled={d.locked || isToggling}
        onClick={() => handleToggle(d)}
        title={d.isOtherProfile ? undefined : (d.description ?? undefined)}
        aria-pressed={d.optedIn}
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          d.optedIn ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
        } disabled:cursor-default`}
      >
        {d.instance ? shortName(d.instance.name) : d.name}
      </button>
    </li>
  );

  return (
    <section className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-expanded={!collapsed}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          {collapsed ? `▸ Dictionaries (${mine.length} on)` : "▾ Dictionaries"}
        </button>
        {!collapsed && (
          <>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full max-w-xs rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => onStoreHiddenChange?.(!storeHidden)}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600"
        >
          {storeHidden ? `Show library (${store.length})` : "Hide library"}
        </button>
        {isLoggedIn && onCreateOwn && (
          <button
            type="button"
            onClick={onCreateOwn}
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white"
          >
            + Create my own
          </button>
        )}
        {isSearching && <span className="text-xs text-neutral-400">Loading...</span>}
          </>
        )}
      </div>

      {!collapsed && (
        <>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Yours in three rows: your own copies, groups you're in, and public ones. */}
      {(["personal", "group", "public"] as const).map((b) => {
        const row = mine.filter((d) => belongsOf(d) === b);
        if (row.length === 0) return null;
        return (
          <div key={b} className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 shrink-0 text-xs font-medium text-neutral-500">{BELONGS_TITLES[b]}</span>
            <ul className="flex flex-wrap gap-1.5">{row.map(chip)}</ul>
          </div>
        );
      })}

      {!storeHidden && (
        <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-neutral-500">Library</span>
            {showLabels && <span className="text-xs text-neutral-400">Filter:</span>}
            {showLabels && suggestions.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLabel(label === l ? null : l)}
                aria-pressed={label === l}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  label === l ? "bg-blue-600 text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-200"
                }`}
              >
                #{l}
              </button>
            ))}
            {showLabels && ranked.length > LABELS_SHOWN && (
              <button type="button" onClick={() => setAllLabels((v) => !v)} className="text-xs text-neutral-500 underline">
                {allLabels ? "Fewer" : "More labels"}
              </button>
            )}
          </div>
          {shownStore.length === 0 ? (
            <p className="text-xs text-neutral-400">{store.length === 0 ? "You've added everything." : "Nothing matches."}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">{shownStore.map(chip)}</ul>
          )}
        </div>
      )}
        </>
      )}
    </section>
  );
}

const LABELS_SHOWN = 12;
const LABELS_FROM = 6;

function labelsOf(d: Dictionary): string[] {
  return [...new Set([...d.labels, ...d.ownLabels])];
}
