"use client";

import { useEffect, useState } from "react";
import type { BasicRecord } from "@/lib/basics";

const PER_PAGE = 9;

// Notepad Display View: notes in a 3x3 grid, newest first, as many pages
// as it takes. The first box is always a blank new note. Every note is
// edited where it sits and saves when you click away; emptying one
// deletes it.
export function NotepadView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [notes, setNotes] = useState<BasicRecord[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId: dictionary.id, kind: "notepad" });
    fetch(`/api/basics?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setNotes(data.items ?? []);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      });
    return () => controller.abort();
  }, [dictionary.id, refreshToken, reloadKey]);

  async function send(body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch("/api/basics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictionaryId: dictionary.id, kind: "notepad", ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }
    } catch (err) {
      setError((err as Error).message);
    }
    setRefreshToken((t) => t + 1);
  }

  // The new-note box takes the first spot, so page one holds eight notes.
  const cells: (BasicRecord | null)[] = [null, ...notes];
  const pageCount = Math.max(1, Math.ceil(cells.length / PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const shown = cells.slice(current * PER_PAGE, (current + 1) * PER_PAGE);

  const box = "h-48 w-full resize-none rounded-md border px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {shown.map((note) =>
          note === null ? (
            <textarea
              key={`new-${refreshToken}`}
              placeholder="+ New note"
              onBlur={(e) => e.target.value.trim() && send({ record: { body: e.target.value } })}
              className={`${box} border-dashed border-neutral-300 bg-white`}
            />
          ) : (
            <div key={note.id} className="group relative">
              <textarea
                key={`${note.id}-${note.body}`}
                defaultValue={String(note.body ?? "")}
                onBlur={(e) => {
                  const body = e.target.value;
                  if (body.trim() === String(note.body ?? "").trim()) return;
                  send(body.trim() ? { record: { id: note.id, body } } : { deleteId: note.id });
                }}
                className={`${box} border-neutral-200 bg-neutral-50`}
              />
              <button
                type="button"
                onClick={() => window.confirm("Delete this note?") && send({ deleteId: note.id })}
                aria-label="Delete note"
                className="absolute right-2 top-1 text-neutral-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ),
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="disabled:opacity-40">
            Prev
          </button>
          <span className="text-neutral-500">
            Page {current + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
            className="disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
