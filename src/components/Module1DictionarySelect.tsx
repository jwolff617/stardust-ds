"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toggleDictionary } from "@/app/actions/dictionaries";

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

export type SelectedDictionary = { id: string; name: string; displayKind: string };

export function Module1DictionarySelect({
  isLoggedIn,
  onSelectionChange,
  reloadKey = 0,
  onChange,
}: {
  isLoggedIn: boolean;
  onSelectionChange?: (dictionaries: SelectedDictionary[]) => void;
  reloadKey?: number;
  onChange?: () => void;
}) {
  const [query, setQuery] = useState("");
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
            ? { id: d.instance.id, name: d.instance.name, displayKind: d.instance.displayKind }
            : { id: d.id, name: d.name, displayKind: d.displayKind },
        ),
    );
  }, [dictionaries, onSelectionChange]);

  function handleToggle(dictionary: Dictionary) {
    if (dictionary.locked) return;

    if (!isLoggedIn) {
      setError("Log in to add or remove dictionaries.");
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

  // One compact row: search, then every dictionary as an on/off chip.
  // Labels still match in search; the description shows on hover.
  return (
    <section className="flex flex-col gap-2 border-b border-neutral-200 px-6 py-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-neutral-500">Dictionaries</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full max-w-xs rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        {isSearching && <span className="text-xs text-neutral-400">Loading...</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-wrap gap-1.5">
        {dictionaries.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              disabled={d.locked || isToggling}
              onClick={() => handleToggle(d)}
              title={d.isOtherProfile ? undefined : (d.description ?? undefined)}
              aria-pressed={d.optedIn}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                d.optedIn
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 text-neutral-600"
              } disabled:cursor-default`}
            >
              {d.instance?.name ?? d.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
