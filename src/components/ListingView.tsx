"use client";

import { useEffect, useState } from "react";
import { deleteListing, getListing } from "@/app/actions/listings";
import type { Listing } from "@/lib/listings";
import { ListingForm } from "./ListingForm";
import { timeAgo } from "./board/parts";
import { tag } from "./ui";

// One listing, in full: its name, who made it and when, then each field as
// a heading and its words. The maker edits it from the top right.
export function ListingView({
  dictionaryId,
  reloadKey = 0,
  onChange,
  compact = false,
}: {
  dictionaryId: string;
  reloadKey?: number;
  onChange?: () => void;
  compact?: boolean;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let live = true;
    getListing(dictionaryId)
      .then((l) => {
        if (!live) return;
        setListing(l);
        setMissing(!l);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [dictionaryId, reloadKey, token]);

  if (missing) return <p className="text-sm text-neutral-500">This was deleted or isn&apos;t shared with you.</p>;
  if (!listing) return <p className="text-sm text-neutral-400">Loading...</p>;

  if (editing) {
    return (
      <ListingForm
        noun="listing"
        fields={listing.fields}
        listing={listing}
        onSaved={() => {
          setEditing(false);
          setToken((t) => t + 1);
          onChange?.();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  async function remove() {
    if (!listing || !window.confirm(`Delete "${listing.name}"? This can't be undone.`)) return;
    await deleteListing(listing.id);
    onChange?.();
    setMissing(true);
  }

  const filled = listing.fields.filter((f) => listing.values[f.key]);

  return (
    <article className="flex flex-col gap-3">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {!compact && <h3 className="text-lg font-semibold leading-snug">{listing.name}</h3>}
          <p className="text-xs text-neutral-500">
            {listing.byName} · {timeAgo(listing.createdAt)}
          </p>
        </div>
        {listing.mine && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-neutral-300 px-3 py-0.5 hover:border-neutral-900">
              Edit
            </button>
            <button type="button" onClick={remove} className="text-neutral-400 hover:text-red-600" aria-label="Delete">
              ✕
            </button>
          </div>
        )}
      </header>

      {filled.length > 0 && (
        <dl className="flex flex-col gap-2.5">
          {filled.map((f) => (
            <div key={f.key}>
              <dt className="text-xs font-medium text-neutral-500">{f.label}</dt>
              <dd className="whitespace-pre-wrap text-sm text-neutral-800">{listing.values[f.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {listing.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {listing.labels.map((l) => (
            <span key={l} className={tag}>
              {l}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
