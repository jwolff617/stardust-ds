"use client";

import { useEffect, useState } from "react";
import { addLabel, getLabels, removeLabel } from "@/app/actions/dictionaries";
import { tag } from "./ui";

// A dictionary's labels, above its Display View. The owner adds and removes
// them; everyone else just sees them. Labeling a dictionary "idea index"
// puts it in Idea Index.
export function DictionaryLabels({ dictionaryId, reloadKey = 0 }: { dictionaryId: string; reloadKey?: number }) {
  const [labels, setLabels] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getLabels(dictionaryId)
      .then((r) => {
        if (!live) return;
        setLabels(r.labels);
        setCanEdit(r.canEdit);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [dictionaryId, reloadKey]);

  async function add() {
    const next = draft.split(",").map((l) => l.trim()).filter(Boolean);
    if (next.length === 0) return;
    setError(null);
    for (const l of next) {
      try {
        const saved = await addLabel(dictionaryId, l);
        setLabels((ls) => [...new Set([...ls, saved])].sort());
      } catch (err) {
        setError((err as Error).message);
      }
    }
    setDraft("");
  }

  async function remove(label: string) {
    setError(null);
    setLabels((ls) => ls.filter((l) => l !== label));
    try {
      await removeLabel(dictionaryId, label);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!canEdit && labels.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <span key={l} className={tag}>
          #{l}
          {canEdit && (
            <button type="button" onClick={() => remove(l)} aria-label={`Remove #${l}`} className="ml-1 text-neutral-400 hover:text-red-600">
              ✕
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          onBlur={add}
          placeholder="+ label"
          aria-label="Add a label"
          maxLength={80}
          className="w-28 rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs"
        />
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
