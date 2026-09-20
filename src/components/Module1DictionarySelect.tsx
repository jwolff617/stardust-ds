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
};

export type SelectedDictionary = { id: string; name: string; displayKind: string };

export function Module1DictionarySelect({
  isLoggedIn,
  onSelectionChange,
}: {
  isLoggedIn: boolean;
  onSelectionChange?: (dictionaries: SelectedDictionary[]) => void;
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
  }, [runSearch]);

  useEffect(() => {
    onSelectionChange?.(
      dictionaries
        .filter((d) => d.optedIn)
        .map((d) =>
          d.instance
            ? { id: d.instance.id, name: d.instance.name, displayKind: d.instance.displayKind }
            : { id: d.id, name: d.name, displayKind: "term_table" },
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
      } catch {
        setDictionaries((prev) =>
          prev.map((d) => (d.id === dictionary.id ? { ...d, optedIn: !nextOptedIn } : d)),
        );
        setError("Couldn't update that dictionary. Try again.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-6">
      <h2 className="text-sm font-medium text-neutral-500">Dictionaries</h2>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search dictionaries..."
        className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isSearching ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dictionaries.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {d.instance?.name ?? d.name}
                  {d.locked && (
                    <span className="ml-2 text-xs text-neutral-400">(locked)</span>
                  )}
                </p>
                {d.description && (
                  <p className="text-xs text-neutral-500">{d.description}</p>
                )}
              </div>
              <button
                type="button"
                disabled={d.locked || isToggling}
                onClick={() => handleToggle(d)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  d.optedIn
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-600"
                } disabled:opacity-50`}
              >
                {d.optedIn ? "On" : "Off"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
