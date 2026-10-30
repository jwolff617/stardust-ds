"use client";

import { useState, type ReactNode } from "react";
import { kindOf, type BoardConfig } from "@/lib/boards";
import { matchFor, type Board, type Post } from "@/lib/posts";
import { useBoard, EMPTY_FILTERS, type Filters } from "./useBoard";
import { PostForm } from "./PostForm";
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
} from "./parts";

// The one layout every post board uses: + New, the same tabs, the same
// filters, the same card, and the same open post with its messages.
// A board passes only what it truly adds: a button beside the card (a
// spark), or a part under the open post (comments and I'm in).
export function BoardView({
  dictionary,
  reloadKey = 0,
  config,
  side,
  extra,
  sorts,
}: {
  dictionary: { id: string; name: string };
  reloadKey?: number;
  config: BoardConfig;
  side?: (post: Post, send: Send) => ReactNode;
  extra?: (post: Post, send: Send) => ReactNode;
  sorts?: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { board, loaded, error, send } = useBoard(dictionary.id, filters, reloadKey);
  const [form, setForm] = useState<{ editing: Post | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change }));
  // Kinds the database has but this board doesn't use stay off it.
  const kinds = board.kinds.map((k) => k.name).filter((n) => kindOf(config, n));

  return (
    <div className="flex flex-col gap-3">
      <BoardTop
        name={dictionary.name}
        intro={board.intro}
        safety={config.safety}
        action={
          <button type="button" className={primary} onClick={() => setForm(form ? null : { editing: null })}>
            {form && !form.editing ? "Cancel" : "+ New"}
          </button>
        }
      />

      {form && (
        <PostForm
          key={form.editing?.id ?? "new"}
          config={config}
          board={board}
          editing={form.editing}
          kindNames={kinds}
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
          kinds={kinds}
          selectedKinds={filters.kinds}
          onKinds={(k) => set({ kinds: k })}
          labels={board.labels}
          selectedLabels={filters.labels}
          onLabels={(labels) => set({ labels })}
          neighborhoods={board.neighborhoods}
          neighborhood={filters.neighborhood}
          onNeighborhood={(neighborhood) => set({ neighborhood })}
          q={filters.q}
          onQ={(q) => set({ q })}
          sort={sorts ? filters.sort : undefined}
          onSort={(sort) => set({ sort })}
        />
      )}

      {filters.view === "review" ? (
        <ReviewList board={board} send={send} render={(p) => <PostCard post={p} config={config} board={board} />} />
      ) : !loaded ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : board.posts.length === 0 ? (
        <EmptyNote view={filters.view} />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {board.posts.map((p) => {
            const open = openId === p.id;
            return (
              <li key={p.id} className="flex flex-col gap-2 py-3">
                <div className="flex gap-3">
                  {side?.(p, send)}
                  <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open} className="flex min-w-0 flex-1 gap-3 text-left">
                    {p.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photos[0].url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded object-cover" />
                    )}
                    <PostCard post={p} config={config} board={board} />
                  </button>
                </div>
                {open && <PostDetail post={p} config={config} send={send} onEdit={() => setForm({ editing: p })} extra={extra} />}
              </li>
            );
          })}
        </ul>
      )}

      <BlockedList board={board} send={send} />
    </div>
  );
}

// One line of kind, title, and price; one line of where, who, and when;
// then anything you need to know.
export function PostCard({ post: p, config, board }: { post: Post; config: BoardConfig; board?: Pick<Board, "mineOpen"> }) {
  const kind = kindOf(config, p.kind);
  const match = board ? matchFor(config, board, p) : null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {config.kinds.length > 1 && (
          <span className="rounded bg-neutral-100 px-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">{p.kind}</span>
        )}
        <span className={`font-medium ${p.status === "closed" ? "text-neutral-400 line-through" : ""}`}>{p.title}</span>
        {p.price && <span className="font-semibold">{p.price}</span>}
        {p.status === "closed" && <span className="text-xs text-neutral-500">{kind?.close.done ?? "Done"}</span>}
      </div>
      <p className="text-xs text-neutral-500">
        {[
          p.neighborhood,
          p.mine ? "You" : p.organization ? null : p.authorName,
          timeAgo(p.createdAt),
          p.joinCount > 0 ? `${p.joinCount} in` : null,
          p.commentCount > 0 ? `${p.commentCount} comment${p.commentCount === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}{" "}
        <OrgBadge org={p.organization} />
      </p>
      {match && <p className="text-xs font-medium text-blue-700">Matches your post: #{match.shared.join(" #")}</p>}
      {p.hidden && <p className="text-xs text-red-700">{p.review === "removed" ? "Removed by a steward." : "Hidden after reports. A steward will look at it."}</p>}
      {p.mine && p.expired && <p className="text-xs text-amber-800">Expired. Renew it to put it back up.</p>}
      {p.threads.some((t) => t.yourTurn) && <p className="text-xs font-medium text-blue-700">Your turn to answer</p>}
    </div>
  );
}

// The open post: photos, its fields, the body, labels, your buttons or
// theirs, then the board's extra part, then private messages.
function PostDetail({
  post: p,
  config,
  send,
  onEdit,
  extra,
}: {
  post: Post;
  config: BoardConfig;
  send: Send;
  onEdit: () => void;
  extra?: (post: Post, send: Send) => ReactNode;
}) {
  const kind = kindOf(config, p.kind);
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
      <PostFields post={p} config={config} />
      <Labels labels={p.labels} />
      {p.mine ? <OwnerActions post={p} kind={kind} send={send} onEdit={onEdit} /> : <OtherActions post={p} send={send} />}
      {extra?.(p, send)}
      <PostThreads post={p} send={send} />
    </div>
  );
}

// A post's own fields and body, as label and answer.
export function PostFields({ post: p, config }: { post: Post; config: BoardConfig }) {
  const kind = kindOf(config, p.kind);
  const fields = (kind?.fields ?? [])
    .map((f) => ({ label: f.label, value: p.details[f.key] }))
    .filter((f): f is { label: string; value: string } => typeof f.value === "string" && Boolean(f.value));
  return (
    <>
      {fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-neutral-500">{f.label}</dt>
              <dd className="whitespace-pre-wrap">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{p.body}</p>}
    </>
  );
}
