"use client";

import { useState, type ReactNode } from "react";
import type { Board, BoardView, Post, Thread } from "@/lib/posts";
import type { BoardKind } from "@/lib/boards";
import { scamWarning } from "@/lib/wording";

// Shared pieces every board's Display View is built from. Each board lays
// them out its own way.

export const input = "rounded-md border border-neutral-300 px-2 py-1.5 text-sm";
export const primary = "rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40";
export const quiet = "rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-40";
export const link = "text-xs text-neutral-600 underline";
export const chip = (on: boolean) =>
  `rounded-full px-2.5 py-1 text-xs ${on ? "bg-blue-600 text-white" : "border border-neutral-300 text-neutral-700"}`;

export type Send = (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// The board's name, its intro, and its safety notes folded away.
export function BoardTop({ name, intro, safety, action }: { name: string; intro: string; safety: string[]; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-neutral-800">{name}</h3>
        <div className="ml-auto">{action}</div>
      </div>
      {intro && <p className="text-sm text-neutral-600">{intro}</p>}
      {safety.length > 0 && (
        <details className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <summary className="cursor-pointer text-xs font-medium">Staying safe</summary>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
            {safety.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// Browse, Your turn, Saved, Yours, and Review for stewards.
export function ViewTabs({
  view,
  onView,
  board,
  names,
}: {
  view: BoardView;
  onView: (v: BoardView) => void;
  board: Board;
  names?: Partial<Record<BoardView, string>>;
}) {
  const tabs: { key: BoardView; label: string }[] = [
    { key: "all", label: names?.all ?? "Browse" },
    { key: "inbox", label: board.waiting > 0 ? `Your turn (${board.waiting})` : names?.inbox ?? "Messages" },
    { key: "saved", label: names?.saved ?? "Saved" },
    { key: "mine", label: names?.mine ?? "Yours" },
  ];
  if (board.me.isSteward) tabs.push({ key: "review", label: "Review" });
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={view === t.key}
          onClick={() => onView(t.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            view === t.key
              ? "bg-neutral-900 text-white"
              : t.key === "inbox" && board.waiting > 0
                ? "border border-blue-600 text-blue-700"
                : "border border-neutral-300 text-neutral-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

// Kind chips, label chips, neighborhood, and search.
export function FilterBar({
  kinds,
  selectedKinds,
  onKinds,
  labels,
  selectedLabels,
  onLabels,
  neighborhoods,
  neighborhood,
  onNeighborhood,
  q,
  onQ,
  searchPlaceholder = "Search",
  extra,
}: {
  kinds: string[];
  selectedKinds: string[];
  onKinds: (v: string[]) => void;
  labels: string[];
  selectedLabels: string[];
  onLabels: (v: string[]) => void;
  neighborhoods: string[];
  neighborhood: string;
  onNeighborhood: (v: string) => void;
  q: string;
  onQ: (v: string) => void;
  searchPlaceholder?: string;
  extra?: ReactNode;
}) {
  const shownLabels = [...new Set([...selectedLabels, ...labels])].slice(0, 16);
  const shownPlaces = [...new Set([neighborhood, ...neighborhoods].filter(Boolean))];
  return (
    <div className="flex flex-col gap-2">
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button key={k} type="button" aria-pressed={selectedKinds.includes(k)} onClick={() => onKinds(toggle(selectedKinds, k))} className={chip(selectedKinds.includes(k))}>
              {k}
            </button>
          ))}
          {extra}
        </div>
      )}
      {shownLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shownLabels.map((l) => (
            <button key={l} type="button" aria-pressed={selectedLabels.includes(l)} onClick={() => onLabels(toggle(selectedLabels, l))} className={chip(selectedLabels.includes(l))}>
              #{l}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => onQ(e.target.value)} placeholder={searchPlaceholder} aria-label="Search" className={`${input} min-w-0 flex-1 sm:max-w-xs`} />
        {shownPlaces.length > 0 && (
          <select value={neighborhood} onChange={(e) => onNeighborhood(e.target.value)} aria-label="Neighborhood" className={`${input} max-w-[11rem]`}>
            <option value="">Anywhere</option>
            {shownPlaces.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export function OrgBadge({ org }: { org: Post["organization"] }) {
  if (!org) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 text-xs font-medium text-emerald-800">
      {org.name}
      {org.verified && <span className="text-[10px] uppercase tracking-wide text-emerald-700">· verified</span>}
    </span>
  );
}

export function Labels({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return <p className="text-xs text-neutral-500">{labels.map((l) => `#${l}`).join(" ")}</p>;
}

const REASONS: { key: string; label: string }[] = [
  { key: "scam", label: "Scam" },
  { key: "unsafe", label: "Unsafe" },
  { key: "unfair", label: "Unfair to someone" },
  { key: "spam", label: "Spam" },
  { key: "sexual", label: "Sexual" },
  { key: "other", label: "Something else" },
];

// Pick a reason, add a note if you want, send.
export function ReportPanel({ what, onSend, onCancel, blocksToo }: { what: string; onSend: (reason: string, note: string) => void; onCancel: () => void; blocksToo?: boolean }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm">
      <p className="text-xs font-medium text-red-900">What&apos;s wrong with this {what}?</p>
      <div className="flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button key={r.key} type="button" onClick={() => setReason(r.key)} className={chip(reason === r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Anything a steward should know (optional)" className={input} />
      <p className="text-xs text-red-900">
        A steward will look at it.{blocksToo ? " This also blocks them, so they can't message you." : " Three reports hide a post until then."}
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={!reason} onClick={() => onSend(reason, note)} className={primary}>
          Send report
        </button>
        <button type="button" onClick={onCancel} className={link}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// One private thread. Scam lines from the other side get a plain warning
// right under them.
export function ThreadBox({
  thread,
  title,
  onSend,
  onBlock,
  onReport,
  placeholder = "Write a message",
  closedToNew,
  starter,
}: {
  thread: Thread | null;
  title: string;
  onSend: (text: string) => Promise<boolean>;
  onBlock?: () => void;
  onReport?: (reason: string, note: string) => void;
  placeholder?: string;
  closedToNew?: boolean;
  // A few lines to start from, offered before the first message.
  starter?: string;
}) {
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState(false);
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSend(text);
    setSending(false);
    if (ok) setText("");
  };
  if (!thread && closedToNew) return <p className="text-xs text-neutral-500">This post is closed to new messages.</p>;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-neutral-200 p-2.5">
      <div className="flex items-center gap-3 text-xs font-medium text-neutral-500">
        {title}
        {thread && onReport && (
          <button type="button" onClick={() => setReporting(!reporting)} className="ml-auto font-normal underline">
            Report
          </button>
        )}
        {thread && onBlock && (
          <button type="button" onClick={onBlock} className={`${onReport ? "" : "ml-auto "}font-normal underline`}>
            Block
          </button>
        )}
      </div>
      {reporting && onReport && (
        <ReportPanel
          what="conversation"
          blocksToo
          onCancel={() => setReporting(false)}
          onSend={(reason, note) => {
            setReporting(false);
            onReport(reason, note);
          }}
        />
      )}
      {thread?.replies.map((r) => {
        const warning = !r.mine && scamWarning(r.body);
        return (
          <div key={r.id} className="flex flex-col gap-0.5">
            <p className={`whitespace-pre-wrap text-sm ${r.mine ? "text-neutral-900" : "text-blue-950"}`}>
              <span className="mr-1 text-xs text-neutral-500">{r.mine ? "You" : r.senderName || "Them"}:</span>
              {r.body}
            </p>
            {warning && <p className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-950">Careful: {warning}</p>}
          </div>
        );
      })}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          maxLength={2000}
          aria-label={placeholder}
          rows={text.includes("\n") ? 4 : 1}
          className={`${input} min-w-0 flex-1 resize-y`}
        />
        <button type="button" disabled={!text.trim() || sending} onClick={submit} className={primary}>
          Send
        </button>
      </div>
      {starter && !thread && !text && (
        <button type="button" onClick={() => setText(starter)} className={`${link} self-start`}>
          Use a starter
        </button>
      )}
    </div>
  );
}

// Your post's controls: edit, close with a kind note to everyone who
// replied, reopen, renew, delete.
export function OwnerActions({ post, kind, send, onEdit }: { post: Post; kind: BoardKind | undefined; send: Send; onEdit: () => void }) {
  const [closing, setClosing] = useState(false);
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState(kind?.close.note ?? "");
  const left = daysLeft(post.expiresAt);
  const replied = post.threads.length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
        <button type="button" className={link} onClick={onEdit}>
          Edit
        </button>
        {post.status === "open" ? (
          <button type="button" className={link} onClick={() => setClosing(!closing)}>
            {kind?.close.verb ?? "Mark closed"}
          </button>
        ) : (
          <button type="button" className={link} onClick={() => send({ action: "reopen", id: post.id })}>
            Reopen
          </button>
        )}
        {(post.expired || (left !== null && left <= 5)) && (
          <button type="button" className={link} onClick={() => send({ action: "renew", id: post.id })}>
            Renew
          </button>
        )}
        <button
          type="button"
          className={`${link} text-red-700`}
          onClick={() => window.confirm("Delete this post for good? Its messages go with it.") && send({ action: "delete", id: post.id })}
        >
          Delete
        </button>
        <span className="text-neutral-500">
          {post.expired ? "Expired, so it's off the board." : left !== null ? `${left} day${left === 1 ? "" : "s"} left` : ""}
        </span>
      </div>
      {closing && (
        <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-2.5 text-sm">
          {replied > 0 && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Let the {replied} {replied === 1 ? "person" : "people"} who wrote know
            </label>
          )}
          {replied > 0 && notify && <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={input} aria-label="Note to everyone who wrote" />}
          <div className="flex gap-2">
            <button
              type="button"
              className={primary}
              onClick={async () => {
                const ok = await send({ action: "close", id: post.id, note: replied > 0 && notify ? note : "" });
                if (ok) setClosing(false);
              }}
            >
              {kind?.close.verb ?? "Mark closed"}
            </button>
            <button type="button" className={link} onClick={() => setClosing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Save, Report, and Block on someone else's post.
export function OtherActions({ post, send, saveLabel = "Save" }: { post: Post; send: Send; saveLabel?: string }) {
  const [reporting, setReporting] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={link} onClick={() => send({ action: post.saved ? "unsave" : "save", id: post.id })}>
          {post.saved ? "Saved (undo)" : saveLabel}
        </button>
        <button type="button" className={link} onClick={() => setReporting(!reporting)}>
          Report
        </button>
        <button
          type="button"
          className={link}
          onClick={() =>
            window.confirm(`Block ${post.authorName}? You won't see each other's posts, and neither of you can message the other. You can undo it at the bottom of the board.`) &&
            send({ action: "block", id: post.id })
          }
        >
          Block
        </button>
      </div>
      {reporting && (
        <ReportPanel
          what="post"
          onCancel={() => setReporting(false)}
          onSend={async (reason, note) => {
            setReporting(false);
            if (await send({ action: "report", id: post.id, reason, note })) window.alert("Thank you. A steward will look at it.");
          }}
        />
      )}
    </div>
  );
}

// The threads on a post: yours with the poster, or every replier's on yours.
export function PostThreads({
  post,
  send,
  emptyMine = "No messages yet.",
  startLabel,
  starter,
}: {
  post: Post;
  send: Send;
  emptyMine?: string;
  startLabel?: string;
  starter?: string;
}) {
  if (post.mine) {
    return (
      <div className="flex flex-col gap-2">
        {post.threads.length === 0 && <p className="text-xs text-neutral-500">{emptyMine}</p>}
        {post.threads.map((t) => (
          <ThreadBox
            key={t.replierId}
            thread={t}
            title={`${t.yourTurn ? "Your turn · " : ""}${t.replierName || "A spark"}`}
            onSend={async (text) => Boolean(await send({ action: "reply", id: post.id, body: text, replierId: t.replierId }))}
            onBlock={() =>
              window.confirm(`Block ${t.replierName || "this spark"}? Neither of you can message the other.`) &&
              send({ action: "block", id: post.id, replierId: t.replierId })
            }
            onReport={(reason, note) => send({ action: "reportThread", id: post.id, replierId: t.replierId, reason, note })}
          />
        ))}
      </div>
    );
  }
  return (
    <ThreadBox
      thread={post.threads[0] ?? null}
      closedToNew={post.status === "closed"}
      title={startLabel ?? `Message ${post.organization?.name ?? post.authorName} privately`}
      starter={starter}
      onSend={async (text) => Boolean(await send({ action: "reply", id: post.id, body: text }))}
      onReport={(reason, note) => send({ action: "reportThread", id: post.id, reason, note })}
    />
  );
}

export function BlockedList({ board, send }: { board: Board; send: Send }) {
  if (board.me.blocked.length === 0) return null;
  return (
    <details className="text-xs text-neutral-600">
      <summary className="cursor-pointer">Blocked ({board.me.blocked.length})</summary>
      <ul className="mt-1 flex flex-col gap-1">
        {board.me.blocked.map((b) => (
          <li key={b.userId} className="flex items-center gap-2">
            {b.name}
            <button type="button" className={link} onClick={() => send({ action: "unblock", userId: b.userId })}>
              Unblock
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

const REASON_NAMES: Record<string, string> = { scam: "scam", unsafe: "unsafe", unfair: "unfair", spam: "spam", sexual: "sexual", other: "other" };

// For stewards: hidden posts with their reports, and reported threads.
export function ReviewList({ board, send, render }: { board: Board; send: Send; render: (p: Post) => ReactNode }) {
  const review = board.review;
  if (!review) return null;
  if (review.posts.length === 0 && review.threads.length === 0) return <p className="text-sm text-neutral-500">Nothing waiting. Thank you for looking.</p>;
  return (
    <div className="flex flex-col gap-4">
      {review.posts.map(({ post, reports }) => (
        <div key={post.id} className="flex flex-col gap-2 rounded-md border border-red-200 p-3">
          {render(post)}
          <ul className="flex flex-col gap-0.5 text-xs text-neutral-700">
            {reports.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{REASON_NAMES[r.reason] ?? r.reason}</span>
                {r.note ? `: ${r.note}` : ""} <span className="text-neutral-400">{timeAgo(r.createdAt)}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className={quiet} onClick={() => send({ action: "review", id: post.id, decision: "clear" })}>
              Clear, put it back
            </button>
            <button type="button" className={primary} onClick={() => send({ action: "review", id: post.id, decision: "remove" })}>
              Remove
            </button>
          </div>
        </div>
      ))}
      {review.threads.map((t) => (
        <div key={`${t.postId}:${t.replierId}`} className="flex flex-col gap-1.5 rounded-md border border-red-200 p-3">
          <p className="text-xs font-medium text-neutral-600">
            Reported conversation on &ldquo;{t.postTitle}&rdquo; · {t.reasons.join(", ")}
          </p>
          {t.notes.map((n, i) => (
            <p key={i} className="text-xs text-neutral-600">
              Note: {n}
            </p>
          ))}
          {t.replies.map((r) => (
            <p key={r.id} className="whitespace-pre-wrap text-sm">
              <span className="mr-1 text-xs text-neutral-500">{r.senderName || "A spark"}:</span>
              {r.body}
            </p>
          ))}
          <div className="flex gap-2">
            <button type="button" className={quiet} onClick={() => send({ action: "resolveThread", id: t.postId, replierId: t.replierId })}>
              Looked at it
            </button>
            <button type="button" className={primary} onClick={() => send({ action: "review", id: t.postId, decision: "remove" })}>
              Remove the post
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 18+ confirmation: birth date and the rules. Only the yes is kept.
export function AdultGate({ rules, send, onCancel }: { rules: string[]; send: Send; onCancel?: () => void }) {
  const [birth, setBirth] = useState("");
  const [agree, setAgree] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-300 p-3 text-sm">
      <p className="font-medium">This part is for adults, 18 and older.</p>
      <label className="flex flex-col gap-1 text-xs text-neutral-600">
        Your birth date (we only keep that you&apos;re 18 or older, never the date)
        <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className={`${input} w-44`} />
      </label>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-neutral-700">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree to these rules.
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={!birth || !agree} className={primary} onClick={() => send({ action: "confirmAdult", birthDate: birth, agree })}>
          Confirm
        </button>
        {onCancel && (
          <button type="button" className={link} onClick={onCancel}>
            Not now
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyNote({ view, empty }: { view: BoardView; empty: string }) {
  const text: Record<BoardView, string> = {
    all: empty,
    inbox: "No messages yet. When you write to someone, or someone writes to you, it shows here.",
    saved: "Nothing saved yet. Tap Save on a post to keep it here.",
    mine: "You haven't posted here yet.",
    review: "Nothing waiting.",
  };
  return <p className="text-sm text-neutral-500">{text[view]}</p>;
}
