"use client";

import { useEffect, useState } from "react";
import { labeledDictionaries, toggleDictionary } from "@/app/actions/dictionaries";
import { IMPORTS_PER_PAGE, type LabeledDictionary } from "@/lib/dictionary-labels";
import { input, tag } from "./ui";

// Search a dictionary's imports: every dictionary carrying one of these
// labels, a page at a time, searched by any words in them. The same search
// for Idea Index, Marketplace, or anyone's own. Open one to add it to your
// feed.
export function LabeledDictionaries({
  labels,
  exceptId,
  reloadKey = 0,
  onChange,
}: {
  labels: string[];
  exceptId?: string;
  reloadKey?: number;
  onChange?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LabeledDictionary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const labelsKey = labels.join(",");

  // Search a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(typed.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [typed]);

  useEffect(() => {
    let live = true;
    labeledDictionaries(labelsKey.split(","), { query, exceptId, page })
      .then((r) => {
        if (!live) return;
        setItems(r.items);
        setTotal(r.total);
        setError(null);
      })
      .catch((err) => live && setError((err as Error).message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [labelsKey, exceptId, query, page, reloadKey]);

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

  const pages = Math.max(1, Math.ceil(total / IMPORTS_PER_PAGE));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={`Search ${labels.join(", ")}`}
          aria-label="Search imports"
          className={`${input} min-w-0 flex-1 sm:max-w-sm`}
        />
        <span className="text-xs text-neutral-500">{loading ? "Searching..." : `${total} found`}</span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-neutral-400">{query ? "Nothing matches. Try fewer words." : "Nothing carries these labels yet."}</p>
      )}

      {items.length > 0 && (
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
              {d.description && <p className="line-clamp-2 text-xs text-neutral-600">{d.description}</p>}
              <div className="flex flex-wrap gap-1">
                {d.labels.map((l) => (
                  <span key={l} className={tag}>
                    {l}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
            Prev
          </button>
          <span className="text-neutral-500">
            Page {page} of {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
