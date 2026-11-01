"use client";

import { useEffect, useState } from "react";
import { labeledDictionaries, toggleDictionary } from "@/app/actions/dictionaries";
import type { CustomField } from "@/lib/custom";
import { IMPORTS_PER_PAGE, type LabeledDictionary } from "@/lib/dictionary-labels";
import { withArticle } from "@/lib/listings";
import { ListingForm } from "./ListingForm";
import { ListingView } from "./ListingView";
import { timeAgo } from "./board/parts";
import { chip, input, primary, tag } from "./ui";

// The one search for every dictionary that imports labels (Idea Index,
// Marketplace, anyone's market village): a page at a time, by any words in
// them, best first. If the dictionary makes listings, "+ New idea" sits
// beside the search. Tap a result to read it here.
export function LabeledDictionaries({
  labels,
  exceptId,
  maker,
  reloadKey = 0,
  onChange,
}: {
  labels: string[];
  exceptId?: string;
  // Set when this dictionary makes listings.
  maker?: { searchId: string; noun: string; fields: CustomField[]; photoLimit: number; lastsDays: number | null };
  reloadKey?: number;
  onChange?: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LabeledDictionary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState(0);
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
    labeledDictionaries(labelsKey.split(","), { query, exceptId, page, mine })
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
  }, [labelsKey, exceptId, query, page, mine, reloadKey, token]);

  async function addToLibrary(d: LabeledDictionary) {
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
  const what = maker ? `${maker.noun}s` : "results";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={maker ? `Search ${maker.noun}s` : `Search ${labels.join(", ")}`}
          aria-label="Search"
          className={`${input} min-w-0 flex-1 sm:max-w-sm`}
        />
        <button type="button" aria-pressed={mine} onClick={() => (setMine(!mine), setPage(1))} className={chip(mine)}>
          Mine
        </button>
        {maker && !composing && (
          <button type="button" onClick={() => (setComposing(true), setNotice(null))} className={`${primary} ml-auto`}>
            + New {maker.noun}
          </button>
        )}
      </div>

      {composing && maker && (
        <ListingForm
          searchId={maker.searchId}
          noun={maker.noun}
          fields={maker.fields}
          photoLimit={maker.photoLimit}
          lastsDays={maker.lastsDays}
          onCancel={() => setComposing(false)}
          onSaved={(id) => {
            setComposing(false);
            setNotice(`Shared. Anyone searching ${labels.join(" or ")} can find it now.`);
            setTyped("");
            setQuery("");
            setPage(1);
            setOpenId(id);
            setToken((t) => t + 1);
          }}
        />
      )}

      {notice && <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-900">{notice}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="text-xs text-neutral-500" aria-live="polite">
        {loading ? "Searching..." : total === 0 ? "" : `${total} ${total === 1 ? what.replace(/s$/, "") : what}${query ? ` matching "${query}"` : ""}`}
      </p>

      {!loading && items.length === 0 && !error && (
        <div className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          {query
            ? "Nothing matches. Try fewer or different words."
            : mine
              ? `You haven't shared ${maker ? withArticle(maker.noun) : "anything here"} yet.`
              : maker
                ? `Nothing here yet. Share the first ${maker.noun}.`
                : "Nothing carries these labels yet."}
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
          {items.map((d) => {
            const open = openId === d.id;
            return (
              <li key={d.id} className={open ? "bg-neutral-50" : ""}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : d.id)}
                  aria-expanded={open}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-neutral-50"
                >
                  {d.photo && !open && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photo} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-md bg-neutral-100 object-cover" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">{d.name}</span>
                      {d.official && <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Official</span>}
                      {d.type !== "Listing" && <span className="text-[11px] text-neutral-400">{d.type}</span>}
                      {d.mine && <span className={tag}>yours</span>}
                      {d.done && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-700">Done</span>}
                      {!d.done && d.ended && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">Ended, renew it</span>}
                      {d.hidden && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">Hidden after reports</span>}
                      {d.unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">✉ {d.unread} new</span>}
                    </span>
                    {d.summary && !open && <span className="line-clamp-2 text-xs text-neutral-600">{d.summary}</span>}
                    <span className="text-[11px] text-neutral-400">
                      {[d.byName, d.createdAt && timeAgo(d.createdAt), d.sparks > 0 && `✦ ${d.sparks}`, d.labels.slice(0, 4).join(" · ")].filter(Boolean).join("  ·  ")}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="flex flex-col gap-3 px-3 pb-3">
                    {d.type === "Listing" ? (
                      <ListingView dictionaryId={d.id} compact onChange={() => setToken((t) => t + 1)} />
                    ) : (
                      d.summary && <p className="text-sm text-neutral-700">{d.summary}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs">
                      {d.optedIn ? (
                        <span className="text-neutral-500">In your Library</span>
                      ) : (
                        <button type="button" onClick={() => addToLibrary(d)} className="rounded-full border border-neutral-300 px-3 py-1 font-medium hover:border-neutral-900">
                          Add to Library
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
            ← Prev
          </button>
          <span className="text-neutral-500">
            Page {page} of {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
