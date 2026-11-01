"use client";

import { useEffect, useState } from "react";
import { labeledDictionaries, toggleDictionary } from "@/app/actions/dictionaries";
import type { LabeledDictionary } from "@/lib/dictionary-labels";
import { tag } from "./ui";

// The dictionaries labeled for a board, shown above its posts. Add one to
// open it in your feed.
export function LabeledDictionaries({
  labels,
  title,
  reloadKey = 0,
  onChange,
}: {
  labels: string[];
  title: string;
  reloadKey?: number;
  onChange?: () => void;
}) {
  const [items, setItems] = useState<LabeledDictionary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const labelsKey = labels.join(",");

  useEffect(() => {
    let live = true;
    labeledDictionaries(labelsKey.split(","))
      .then((r) => live && setItems(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [labelsKey, reloadKey]);

  async function open(d: LabeledDictionary) {
    setError(null);
    try {
      await toggleDictionary(d.id, true);
      setItems((xs) => xs.map((x) => (x.id === d.id ? { ...x, optedIn: true } : x)));
      onChange?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((d) => (
          <li key={d.id} className="flex flex-col gap-1 rounded-md border border-neutral-200 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{d.name}</span>
              {d.mine && <span className={tag}>yours</span>}
              <span className="ml-auto">
                {d.optedIn ? (
                  <span className="text-xs text-neutral-400">In your feed</span>
                ) : (
                  <button type="button" onClick={() => open(d)} className="text-xs text-blue-700 underline">
                    Open
                  </button>
                )}
              </span>
            </div>
            {d.description && <p className="text-xs text-neutral-600">{d.description}</p>}
            <div className="flex flex-wrap gap-1">
              {d.labels.map((l) => (
                <span key={l} className={tag}>
                  #{l}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
