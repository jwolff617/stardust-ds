"use client";

import { useEffect, useState, useTransition } from "react";
import { ProfileFields } from "./ProfileFields";
import { NightNotes } from "./NightNotes";
import { AccountsView } from "./AccountsView";
import { WorthyView } from "./WorthyView";

type SelectedDictionary = { id: string; name: string; displayKind: string };
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
const DISPLAY_KINDS = ["profile", "notes_list", "accounts", "worthy"];

export function Module2Definitions({
  dictionaries,
  reloadKey = 0,
  onRefresh,
}: {
  dictionaries: SelectedDictionary[];
  reloadKey?: number;
  onRefresh?: () => void;
}) {
  // Everything opted-in is active by default; track what's unchecked so
  // newly opted-in dictionaries show up active with no effect needed.
  const [deselectedIds, setDeselectedIds] = useState<string[]>([]);
  const [activeTabs, setActiveTabs] = useState<PartOfSpeech[]>(["verb", "noun", "more"]);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DefinitionRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, startLoading] = useTransition();

  const activeDictionaryIds = dictionaries
    .map((d) => d.id)
    .filter((id) => !deselectedIds.includes(id));

  const displayable = dictionaries.filter(
    (d) => DISPLAY_KINDS.includes(d.displayKind) && !deselectedIds.includes(d.id),
  );
  const hasDisplay = displayable.length > 0;
  const ofKind = (kind: string) => displayable.filter((d) => d.displayKind === kind);
  const profileDictionaries = ofKind("profile");
  const notesDictionaries = ofKind("notes_list");
  const accountsDictionaries = ofKind("accounts");
  const worthyDictionaries = ofKind("worthy");

  // Display View is the landing view when a personal dictionary other than
  // the always-on profiles is active. Computed during render so there's no
  // extra commit.
  const prefersDisplay = displayable.some((d) => d.displayKind !== "profile");
  const [viewMode, setViewMode] = useState<"term" | "display">(prefersDisplay ? "display" : "term");
  const [prevPrefersDisplay, setPrevPrefersDisplay] = useState(prefersDisplay);
  if (prefersDisplay !== prevPrefersDisplay) {
    setPrevPrefersDisplay(prefersDisplay);
    setViewMode(prefersDisplay ? "display" : "term");
  }

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

  function toggleDictionaryFilter(id: string) {
    setDeselectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleTab(tab: PartOfSpeech) {
    setActiveTabs((prev) =>
      prev.includes(tab) ? prev.filter((x) => x !== tab) : [...prev, tab],
    );
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
    <section className="flex flex-col gap-2 border-b border-neutral-200 px-6 py-6">
      <RefreshButton onRefresh={onRefresh} />
      <div className="flex gap-6">
        <aside className="flex w-40 shrink-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-neutral-500">Dictionaries</h3>
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
          {dictionaries.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!deselectedIds.includes(d.id)}
                onChange={() => toggleDictionaryFilter(d.id)}
              />
              {d.name}
            </label>
          ))}
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
              {notesDictionaries.length > 0 && (
                <NightNotes dictionaries={notesDictionaries.map((d) => ({ id: d.id, name: d.name }))} reloadKey={reloadKey} />
              )}
              {accountsDictionaries.map((d) => (
                <AccountsView key={d.id} dictionary={{ id: d.id, name: d.name }} reloadKey={reloadKey} />
              ))}
              {worthyDictionaries.map((d) => (
                <WorthyView key={d.id} dictionary={{ id: d.id, name: d.name }} reloadKey={reloadKey} />
              ))}
              {profileDictionaries.length > 0 && (
                <ProfileFields dictionaries={profileDictionaries.map((d) => ({ id: d.id, name: d.name }))} reloadKey={reloadKey} />
              )}
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
