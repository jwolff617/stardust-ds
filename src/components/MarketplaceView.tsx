"use client";

import { useState } from "react";
import { MARKETPLACE, kindOf } from "@/lib/boards";
import { matchFor, type Post } from "@/lib/posts";
import { useBoard, EMPTY_FILTERS, type Filters } from "./board/useBoard";
import { PostForm } from "./board/PostForm";
import {
  BlockedList,
  BoardTop,
  EmptyNote,
  FilterBar,
  Labels,
  OrgBadge,
  OtherActions,
  OwnerActions,
  PostThreads,
  ReviewList,
  ViewTabs,
  primary,
  timeAgo,
  type Send,
} from "./board/parts";

// Marketplace: buy, sell, give, trade, housing. Photos and prices up front,
// newest first, private messages, and a kind note to everyone when it's gone.
export function MarketplaceView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { board, loaded, error, send } = useBoard(dictionary.id, filters, reloadKey);
  const [form, setForm] = useState<{ editing: Post | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change }));

  return (
    <div className="flex flex-col gap-3">
      <BoardTop
        name={dictionary.name}
        intro={board.intro}
        safety={MARKETPLACE.safety}
        action={
          <button type="button" className={primary} onClick={() => setForm(form ? null : { editing: null })}>
            {form && !form.editing ? "Cancel" : `+ ${MARKETPLACE.newPost}`}
          </button>
        }
      />

      {form && (
        <PostForm
          key={form.editing?.id ?? "new"}
          config={MARKETPLACE}
          board={board}
          editing={form.editing}
          send={send}
          onDone={(id) => {
            setForm(null);
            if (id) setOpenId(id);
          }}
        />
      )}

      <ViewTabs view={filters.view} onView={(view) => set({ view })} board={board} />
      {error && <p className="text-sm text-red-700">{error}</p>}

      {filters.view === "all" && (
        <FilterBar
          kinds={board.kinds.map((k) => k.name)}
          selectedKinds={filters.kinds}
          onKinds={(kinds) => set({ kinds })}
          labels={board.labels}
          selectedLabels={filters.labels}
          onLabels={(labels) => set({ labels })}
          neighborhoods={board.neighborhoods}
          neighborhood={filters.neighborhood}
          onNeighborhood={(neighborhood) => set({ neighborhood })}
          q={filters.q}
          onQ={(q) => set({ q })}
          searchPlaceholder="Search: crib, bike, room"
        />
      )}

      {filters.view === "review" ? (
        <ReviewList board={board} send={send} render={(p) => <ListingSummary post={p} />} />
      ) : !loaded ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : board.posts.length === 0 ? (
        <EmptyNote view={filters.view} empty="Nothing here yet. Post the first thing: something you can give away is a good start." />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {board.posts.map((p) => {
            const match = matchFor(MARKETPLACE, board, p);
            const open = openId === p.id;
            return (
              <li key={p.id} className="flex flex-col gap-2 py-3">
                <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open} className="flex gap-3 text-left">
                  {p.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photos[0].url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded object-cover" />
                  )}
                  <ListingSummary post={p} match={match ? `Matches your ${match.mine.kind} post: #${match.shared.join(" #")}` : null} />
                </button>
                {open && <ListingDetail post={p} send={send} onEdit={() => setForm({ editing: p })} />}
              </li>
            );
          })}
        </ul>
      )}

      <BlockedList board={board} send={send} />
    </div>
  );
}

function ListingSummary({ post: p, match }: { post: Post; match?: string | null }) {
  const kind = kindOf(MARKETPLACE, p.kind);
  const facts = [p.details.condition, p.details.pickup, p.details.type, p.details.side].filter((v): v is string => typeof v === "string" && Boolean(v));
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`rounded px-1.5 text-[11px] font-medium uppercase tracking-wide ${p.kind === "Free" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>
          {p.kind}
        </span>
        <span className={`font-medium ${p.status === "closed" ? "text-neutral-400 line-through" : ""}`}>{p.title}</span>
        {p.price && <span className="font-semibold">{p.price}</span>}
        {p.status === "closed" && <span className="text-xs text-neutral-500">{kind?.close.done ?? "Closed"}</span>}
      </div>
      <p className="text-xs text-neutral-500">
        {[p.neighborhood, p.mine ? "You" : p.organization ? null : p.authorName, timeAgo(p.createdAt), ...facts].filter(Boolean).join(" · ")}{" "}
        <OrgBadge org={p.organization} />
      </p>
      {match && <p className="text-xs font-medium text-blue-700">{match}</p>}
      {p.hidden && <p className="text-xs text-red-700">{p.review === "removed" ? "Removed by a steward." : "Hidden after reports. A steward will look at it."}</p>}
      {p.mine && p.expired && <p className="text-xs text-amber-800">Expired. Renew it to put it back up.</p>}
      {p.threads.some((t) => t.yourTurn) && <p className="text-xs font-medium text-blue-700">Your turn to answer</p>}
    </div>
  );
}

function ListingDetail({ post: p, send, onEdit }: { post: Post; send: Send; onEdit: () => void }) {
  const kind = kindOf(MARKETPLACE, p.kind);
  const fields = (kind?.fields ?? [])
    .map((f) => ({ label: f.label, value: p.details[f.key] }))
    .filter((f): f is { label: string; value: string } => typeof f.value === "string" && Boolean(f.value));
  return (
    <div className="flex flex-col gap-2.5 sm:pl-2">
      {p.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {p.photos.map((ph) => (
            <a key={ph.path} href={ph.url} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt="" loading="lazy" className="h-40 rounded object-cover" />
            </a>
          ))}
        </div>
      )}
      {fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-neutral-500">{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{p.body}</p>}
      <Labels labels={p.labels} />
      {p.kind === "Housing" && !p.mine && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-950">See the place inside and meet the person before you pay anything.</p>
      )}
      {p.mine ? <OwnerActions post={p} kind={kind} send={send} onEdit={onEdit} /> : <OtherActions post={p} send={send} />}
      <PostThreads post={p} send={send} emptyMine="No messages yet. People who write to you show up here." />
    </div>
  );
}
