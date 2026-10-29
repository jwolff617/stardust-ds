"use client";

import { useEffect, useState } from "react";
import { IDEA_INDEX, kindOf } from "@/lib/boards";
import type { Comment, Join, Post } from "@/lib/posts";
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
  ReportPanel,
  ReviewList,
  ViewTabs,
  chip,
  input,
  link,
  primary,
  quiet,
  timeAgo,
  type Send,
} from "./board/parts";

// Idea Index: ideas as cards with sparks (no downvotes), open comments,
// and I'm In. Sort by newest or most sparked, never by who's "top".
export function IdeasView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
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
        safety={IDEA_INDEX.safety}
        action={
          <button type="button" className={primary} onClick={() => setForm(form ? null : { editing: null })}>
            {form && !form.editing ? "Cancel" : `+ ${IDEA_INDEX.newPost}`}
          </button>
        }
      />

      {form && (
        <PostForm
          key={form.editing?.id ?? "new"}
          config={IDEA_INDEX}
          board={board}
          editing={form.editing}
          send={send}
          onDone={(id) => {
            setForm(null);
            if (id) setOpenId(id);
          }}
        />
      )}

      <ViewTabs view={filters.view} onView={(view) => set({ view })} board={board} names={{ mine: "Your ideas" }} />
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
          searchPlaceholder="Search ideas"
          extra={
            <span className="ml-auto flex gap-1.5">
              <button type="button" aria-pressed={filters.sort === "new"} onClick={() => set({ sort: "new" })} className={chip(filters.sort === "new")}>
                Newest
              </button>
              <button type="button" aria-pressed={filters.sort === "votes"} onClick={() => set({ sort: "votes" })} className={chip(filters.sort === "votes")}>
                Most sparked
              </button>
            </span>
          }
        />
      )}

      {filters.view === "review" ? (
        <ReviewList board={board} send={send} render={(p) => <IdeaCard post={p} />} />
      ) : !loaded ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : board.posts.length === 0 ? (
        <EmptyNote view={filters.view} empty="No ideas yet. Post the one you keep thinking about, even if it's small." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {board.posts.map((p) => {
            const open = openId === p.id;
            return (
              <li key={p.id} className={`flex flex-col gap-2 rounded-md border border-neutral-200 p-3 ${open ? "sm:col-span-2" : ""}`}>
                <div className="flex gap-3">
                  <SparkButton post={p} send={send} />
                  <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open} className="min-w-0 flex-1 text-left">
                    <IdeaCard post={p} />
                  </button>
                </div>
                {open && <IdeaDetail post={p} send={send} onEdit={() => setForm({ editing: p })} />}
              </li>
            );
          })}
        </ul>
      )}

      <BlockedList board={board} send={send} />
    </div>
  );
}

function SparkButton({ post: p, send }: { post: Post; send: Send }) {
  return (
    <button
      type="button"
      disabled={p.mine}
      aria-pressed={p.voted}
      aria-label={p.voted ? "Take back your spark" : "Spark this idea"}
      title={p.mine ? "Your idea" : p.voted ? "You sparked this. Tap to take it back." : "Spark: say you love it"}
      onClick={() => send({ action: p.voted ? "unspark" : "spark", id: p.id })}
      className={`flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-md border text-xs ${
        p.voted ? "border-amber-500 bg-amber-50 text-amber-800" : "border-neutral-300 text-neutral-600"
      } disabled:opacity-60`}
    >
      <span aria-hidden className="text-base leading-none">
        ✦
      </span>
      {p.voteCount}
    </button>
  );
}

function IdeaCard({ post: p }: { post: Post }) {
  const d = p.details as Record<string, string | undefined>;
  const line = p.kind === "Need" ? d.would_help : p.kind === "Building" ? [d.stage, d.looking_for && `Looking for: ${d.looking_for}`].filter(Boolean).join(" · ") : d.first_step && `First step: ${d.first_step}`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={`rounded px-1.5 text-[11px] font-medium uppercase tracking-wide ${
            p.kind === "Building" ? "bg-emerald-100 text-emerald-800" : p.kind === "Need" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {p.kind}
        </span>
        <span className={`font-semibold ${p.status === "closed" ? "text-neutral-400 line-through" : ""}`}>{p.title}</span>
      </div>
      {p.body && <p className="line-clamp-2 text-sm text-neutral-700">{p.body}</p>}
      {line && <p className="text-xs text-neutral-600">{line}</p>}
      <p className="text-xs text-neutral-500">
        {[
          p.mine ? "You" : p.organization ? null : p.authorName,
          p.neighborhood,
          timeAgo(p.createdAt),
          p.joinCount > 0 ? `${p.joinCount} in` : null,
          p.commentCount > 0 ? `${p.commentCount} comment${p.commentCount === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}{" "}
        <OrgBadge org={p.organization} />
      </p>
      {p.hidden && <p className="text-xs text-red-700">{p.review === "removed" ? "Removed by a steward." : "Hidden after reports. A steward will look at it."}</p>}
      {p.threads.some((t) => t.yourTurn) && <p className="text-xs font-medium text-blue-700">Your turn to answer a message</p>}
    </div>
  );
}

function IdeaDetail({ post: p, send, onEdit }: { post: Post; send: Send; onEdit: () => void }) {
  const kind = kindOf(IDEA_INDEX, p.kind);
  const [extras, setExtras] = useState<{ comments: Comment[]; joins: Join[] } | null>(null);
  const [token, setToken] = useState(0);
  const [showMessages, setShowMessages] = useState(p.threads.length > 0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/posts/extras?postId=${p.id}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => !data.error && setExtras(data))
      .catch(() => {});
    return () => controller.abort();
  }, [p.id, token, p.commentCount, p.joinCount]);

  // Actions here also reload the open conversation.
  const act: Send = async (body) => {
    const res = await send(body);
    setToken((t) => t + 1);
    return res;
  };

  const fields = (kind?.fields ?? [])
    .map((f) => ({ label: f.label, value: p.details[f.key] }))
    .filter((f): f is { label: string; value: string } => typeof f.value === "string" && Boolean(f.value));

  return (
    <div className="flex flex-col gap-3">
      {p.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{p.body}</p>}
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
      <Labels labels={p.labels} />

      <WhosIn post={p} joins={extras?.joins ?? []} send={act} />

      {p.mine ? <OwnerActions post={p} kind={kind} send={send} onEdit={onEdit} /> : <OtherActions post={p} send={send} />}

      <Comments post={p} comments={extras?.comments ?? null} send={act} />

      {p.mine || showMessages ? (
        <PostThreads post={p} send={send} emptyMine="No private messages yet." startLabel={`Message ${p.authorName} privately`} />
      ) : (
        <button type="button" className={`${link} self-start`} onClick={() => setShowMessages(true)}>
          Message {p.authorName} privately
        </button>
      )}
    </div>
  );
}

function WhosIn({ post: p, joins, send }: { post: Post; joins: Join[]; send: Send }) {
  const mine = joins.find((j) => j.mine);
  const [offer, setOffer] = useState("");
  const [asking, setAsking] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-emerald-50 p-2.5">
      <p className="text-xs font-medium text-emerald-900">
        {joins.length === 0 ? (p.mine ? "Nobody has said I'm in yet." : "Be the first to say I'm in.") : `${joins.length} ${joins.length === 1 ? "person is" : "people are"} in`}
      </p>
      {joins.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {joins.map((j) => (
            <li key={j.userId}>
              <span className="font-medium">{j.mine ? "You" : j.name}</span>
              {j.offer && <span className="text-neutral-700">: {j.offer}</span>}
              {p.mine && (
                <button type="button" className={`${link} ml-2`} onClick={() => window.confirm(`Take ${j.name} off this idea?`) && send({ action: "removeJoin", id: p.id, userId: j.userId })}>
                  Take off
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!p.mine &&
        (mine ? (
          <button type="button" className={`${link} self-start`} onClick={() => send({ action: "leave", id: p.id })}>
            Step out
          </button>
        ) : asking ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={200} placeholder="What you'd bring: I can do design, I have a garage" className={`${input} min-w-0 flex-1`} />
            <button type="button" className={primary} onClick={async () => (await send({ action: "join", id: p.id, offer })) && setAsking(false)}>
              I&apos;m in
            </button>
          </div>
        ) : (
          <button type="button" className={`${quiet} self-start`} onClick={() => setAsking(true)}>
            I&apos;m in
          </button>
        ))}
    </div>
  );
}

function Comments({ post: p, comments, send }: { post: Post; comments: Comment[] | null; send: Send }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const top = (comments ?? []).filter((c) => !c.parentId);
  const repliesTo = (id: string) => (comments ?? []).filter((c) => c.parentId === id);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-neutral-600">Open conversation</p>
      {comments === null ? (
        <p className="text-xs text-neutral-500">Loading...</p>
      ) : top.length === 0 ? (
        <p className="text-xs text-neutral-500">No comments yet. Anyone on the board can read what you write here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {top.map((c) => (
            <li key={c.id} className="flex flex-col gap-1">
              <CommentLine comment={c} send={send} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
              <ul className="ml-4 flex flex-col gap-1 border-l border-neutral-200 pl-3">
                {repliesTo(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentLine comment={r} send={send} />
                  </li>
                ))}
              </ul>
              {replyTo === c.id && (
                <CommentBox
                  placeholder={`Reply to ${c.authorName}`}
                  onSend={async (body) => {
                    const ok = await send({ action: "comment", id: p.id, body, parentId: c.id });
                    if (ok) setReplyTo(null);
                    return Boolean(ok);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <CommentBox
        placeholder="Add a comment"
        value={text}
        onChange={setText}
        onSend={async (body) => Boolean(await send({ action: "comment", id: p.id, body }))}
      />
    </div>
  );
}

function CommentLine({ comment: c, send, onReply }: { comment: Comment; send: Send; onReply?: () => void }) {
  const [reporting, setReporting] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <p className="whitespace-pre-wrap text-sm">
        <span className="mr-1 text-xs font-medium text-neutral-600">{c.mine ? "You" : c.authorName}</span>
        <span className="mr-1 text-xs text-neutral-400">{timeAgo(c.createdAt)}</span>
        {c.body}
      </p>
      {c.hidden && <p className="text-xs text-red-700">Hidden after reports.</p>}
      <div className="flex gap-3">
        {onReply && (
          <button type="button" className={link} onClick={onReply}>
            Reply
          </button>
        )}
        {c.mine ? (
          <button type="button" className={link} onClick={() => window.confirm("Delete your comment?") && send({ action: "deleteComment", commentId: c.id })}>
            Delete
          </button>
        ) : (
          <button type="button" className={link} onClick={() => setReporting(!reporting)}>
            Report
          </button>
        )}
      </div>
      {reporting && (
        <ReportPanel
          what="comment"
          onCancel={() => setReporting(false)}
          onSend={(reason, note) => {
            setReporting(false);
            send({ action: "reportComment", commentId: c.id, reason, note });
          }}
        />
      )}
    </div>
  );
}

function CommentBox({
  placeholder,
  onSend,
  value,
  onChange,
}: {
  placeholder: string;
  onSend: (body: string) => Promise<boolean>;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [own, setOwn] = useState("");
  const text = value ?? own;
  const setText = onChange ?? setOwn;
  return (
    <div className="flex gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder={placeholder} aria-label={placeholder} className={`${input} min-w-0 flex-1 resize-y`} />
      <button type="button" disabled={!text.trim()} className={primary} onClick={async () => (await onSend(text)) && setText("")}>
        Post
      </button>
    </div>
  );
}
