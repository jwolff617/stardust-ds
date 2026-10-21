"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { addLabel, removeLabel, toggleDictionary } from "@/app/actions/dictionaries";

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
      } catch {
        setDictionaries((prev) =>
          prev.map((d) => (d.id === dictionary.id ? { ...d, optedIn: !nextOptedIn } : d)),
        );
        setError("Couldn't update that dictionary. Try again.");
      }
    });
  }

  function updateOwnLabels(dictionaryId: string, ownLabels: string[]) {
    setDictionaries((prev) => prev.map((d) => (d.id === dictionaryId ? { ...d, ownLabels } : d)));
  }

  async function handleAddLabel(dictionary: Dictionary, raw: string) {
    if (!dictionary.labelTargetId) return;
    try {
      const label = await addLabel(dictionary.labelTargetId, raw);
      if (!dictionary.ownLabels.includes(label)) {
        updateOwnLabels(dictionary.id, [...dictionary.ownLabels, label].sort());
      }
    } catch (err) {
      setError((err as Error).message || "Couldn't add that label.");
    }
  }

  async function handleRemoveLabel(dictionary: Dictionary, label: string) {
    if (!dictionary.labelTargetId) return;
    updateOwnLabels(dictionary.id, dictionary.ownLabels.filter((l) => l !== label));
    try {
      await removeLabel(dictionary.labelTargetId, label);
    } catch {
      updateOwnLabels(dictionary.id, dictionary.ownLabels);
      setError("Couldn't remove that label. Try again.");
    }
  }

  return (
    <section className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-6">
      <h2 className="text-sm font-medium text-neutral-500">Dictionaries</h2>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find dictionaries by name or label..."
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
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium">
                  {d.instance?.name ?? d.name}
                  {d.locked && (
                    <span className="ml-2 text-xs text-neutral-400">(locked)</span>
                  )}
                </p>
                {d.description && !d.isOtherProfile && (
                  <p className="text-xs text-neutral-500">{d.description}</p>
                )}
                <LabelList
                  labels={d.labels}
                  ownLabels={d.ownLabels}
                  editable={isLoggedIn && Boolean(d.labelTargetId)}
                  onAdd={(label) => handleAddLabel(d, label)}
                  onRemove={(label) => handleRemoveLabel(d, label)}
                />
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

function LabelList({
  labels,
  ownLabels,
  editable,
  onAdd,
  onRemove,
}: {
  labels: string[];
  ownLabels: string[];
  editable: boolean;
  onAdd: (label: string) => void;
  onRemove: (label: string) => void;
}) {
  const [draft, setDraft] = useState("");

  if (labels.length === 0 && ownLabels.length === 0 && !editable) return null;

  function submit() {
    const label = draft.trim();
    if (!label) return;
    onAdd(label);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {labels.map((label) => (
        <span key={`shared-${label}`} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          {label}
        </span>
      ))}
      {ownLabels.map((label) => (
        <span
          key={`own-${label}`}
          className="flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-700"
        >
          {label}
          {editable && (
            <button
              type="button"
              onClick={() => onRemove(label)}
              className="text-neutral-400 hover:text-red-600"
              aria-label={`Remove label ${label}`}
            >
              ✕
            </button>
          )}
        </span>
      ))}
      {editable && (
        <input
          type="text"
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="+ label"
          aria-label="Add a label"
          className="w-24 rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs"
        />
      )}
    </div>
  );
}
