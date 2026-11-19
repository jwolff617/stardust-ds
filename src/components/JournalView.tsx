"use client";

import { useEffect, useState } from "react";
import type { BasicRecord } from "@/lib/basics";
import { input, primary } from "./ui";

const PER_PAGE = 10;

function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// Journal Display View: write today's entry at the top, past entries
// below, newest first, each under its date. Click an entry to edit it;
// emptying one deletes it.
export function JournalView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [entries, setEntries] = useState<BasicRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [shown, setShown] = useState(PER_PAGE);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId: dictionary.id, kind: "journal" });
    fetch(`/api/basics?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEntries(data.items ?? []);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      });
    return () => controller.abort();
  }, [dictionary.id, token, reloadKey]);

  async function send(body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch("/api/basics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictionaryId: dictionary.id, kind: "journal", ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setToken((t) => t + 1);
    }
  }

  async function saveEdit(entry: BasicRecord) {
    const text = editText.trim();
    setEditingId(null);
    if (text === String(entry.body ?? "").trim()) return;
    if (!text) await send({ deleteId: entry.id });
    else await send({ record: { id: entry.id, body: text } });
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          if (await send({ record: { body: draft.trim() } })) setDraft("");
        }}
        className="flex flex-col gap-2"
      >
        <p className="text-xs text-neutral-500">{dayOf(new Date().toISOString())}</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          maxLength={50000}
          placeholder="What happened today? How did it feel?"
          className={`${input} resize-y`}
        />
        <button type="submit" disabled={!draft.trim()} className={`${primary} self-start`}>
          Save entry
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {entries.length === 0 && <p className="text-sm text-neutral-400">No entries yet.</p>}

      {entries.slice(0, shown).map((entry) => (
        <div key={entry.id} className="flex flex-col gap-1 border-t border-neutral-100 pt-2">
          <p className="text-xs font-medium text-neutral-500">{dayOf(entry.createdAt)}</p>
          {editingId === entry.id ? (
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={() => saveEdit(entry)}
              rows={Math.min(12, Math.max(3, editText.split("\n").length + 1))}
              className={`${input} resize-y`}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingId(entry.id);
                setEditText(String(entry.body ?? ""));
              }}
              className="whitespace-pre-wrap text-left text-sm text-neutral-800"
            >
              {String(entry.body ?? "")}
            </button>
          )}
        </div>
      ))}

      {entries.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PER_PAGE)} className="self-start text-xs text-neutral-500 underline">
          Older entries
        </button>
      )}
    </div>
  );
}
