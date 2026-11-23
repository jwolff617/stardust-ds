"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; term: string; body: string; partOfSpeech: string; kind: string };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const FILTERS = [
  { key: "all", label: "All" },
  { key: "noun", label: "Nouns" },
  { key: "verb", label: "Verbs" },
  { key: "organization", label: "Organizations" },
  { key: "person", label: "People" },
  { key: "mine", label: "Mine" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

// The Stardust Dictionary in a window over the page, about three
// quarters of the screen. X closes it; minimize keeps your page and
// leaves a small tab to bring it back.
export function DictionaryPopup({
  minimized,
  onMinimize,
  onRestore,
  onClose,
  onPick,
}: {
  minimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onClose: () => void;
  // Clicking a word opens it on the page.
  onPick: (entry: Entry) => void;
}) {
  const [page, setPage] = useState(1);
  const [letter, setLetter] = useState("");
  const [items, setItems] = useState<Entry[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), filter });
    if (letter) params.set("letter", letter);
    fetch(`/api/stardust-dictionary?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
        setNote(data.note ?? "");
        if (letter) {
          setLetter("");
          setPage(data.page ?? 1);
        }
        setLoading(false);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [page, letter, filter]);

  useEffect(() => {
    if (minimized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPage((p) => Math.min(totalPages, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minimized, onClose, totalPages]);

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onRestore}
        className="fixed bottom-4 left-4 z-50 rounded-full border border-[var(--line)] bg-[var(--background)] px-4 py-2 text-sm tracking-widest shadow-lg"
      >
        DICTIONARY ▴
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Stardust Dictionary"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[80vh] w-full max-w-5xl flex-col border-[1.5px] border-[var(--foreground)] bg-[var(--background)] text-[var(--foreground)] shadow-2xl sm:h-[75vh] sm:w-[75vw]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-[11px] font-bold tracking-[0.25em]">STARDUST DICTIONARY</h2>
          <button type="button" onClick={onMinimize} aria-label="Minimize" className="ml-auto px-2 text-lg text-[var(--muted)] hover:text-[var(--foreground)]">
            –
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-lg text-[var(--muted)] hover:text-[var(--foreground)]">
            ×
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[var(--line)] px-5 py-2 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-0.5 tracking-wider ${
                filter === f.key ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--line)] hover:border-[var(--foreground)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-2 gap-y-1 border-b border-[var(--line)] px-5 py-2 text-xs">
          {LETTERS.map((l) => (
            <button key={l} type="button" onClick={() => setLetter(l)} className="text-[var(--muted)] hover:text-[var(--foreground)]">
              {l}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && items.length === 0 ? (
            <p className="text-sm opacity-50">Opening the dictionary...</p>
          ) : items.length === 0 ? (
            <p className="text-sm opacity-60">{note || "Nothing here yet."}</p>
          ) : (
            <dl className="flex flex-col gap-4">
              {items.map((e) => (
                <div key={e.id}>
                  <dt>
                    <button type="button" onClick={() => onPick(e)} className="text-left font-semibold hover:underline">
                      {e.term}
                    </button>
                    <span className="ml-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">{e.partOfSpeech}</span>
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{e.body}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">
            ← Previous
          </button>
          <span className="opacity-60">
            Page {page} of {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
