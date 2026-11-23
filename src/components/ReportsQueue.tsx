"use client";

import { useEffect, useState } from "react";
import { entryReportsWaiting, reviewEntry, type WaitingEntry } from "@/app/actions/profile";
import { primary, quiet } from "./ui";

// For moderators: every reported profile entry, hidden ones first.
// Clear puts it back up; Remove keeps it down for good.
export function ReportsQueue() {
  const [items, setItems] = useState<WaitingEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    entryReportsWaiting()
      .then(setItems)
      .catch((err) => setError((err as Error).message));
  }, [token]);

  async function decide(w: WaitingEntry, remove: boolean) {
    if (remove && !window.confirm(`Remove "${w.word}" for good?`)) return;
    setError(null);
    try {
      await reviewEntry(w.id, remove);
      setToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!items) return <p className="text-xs text-neutral-400">{error ?? "Loading reports..."}</p>;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50/40 p-3">
      <p className="text-xs font-semibold text-red-900">Reports ({items.length})</p>
      {items.length === 0 && <p className="text-xs text-neutral-500">Nothing waiting.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ul className="flex flex-col gap-2">
        {items.map((w) => (
          <li key={w.id} className="flex flex-col gap-2 rounded-md bg-white p-2.5 ring-1 ring-neutral-200">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-neutral-900">{w.word}</span>
              <span className="text-neutral-500">by {w.ownerName || "a spark"}</span>
              {w.hidden && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">Hidden</span>}
              <span className="text-neutral-500">
                {w.reports} report{w.reports === 1 ? "" : "s"}
                {w.reasons.length ? `: ${w.reasons.join(", ")}` : ""}
              </span>
            </div>
            {w.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{w.body}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => decide(w, false)} className={quiet}>
                Clear
              </button>
              <button type="button" onClick={() => decide(w, true)} className={primary}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
