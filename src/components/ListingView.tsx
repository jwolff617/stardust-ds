"use client";

import { useEffect, useState } from "react";
import {
  addComment,
  blockMaker,
  deleteComment,
  deleteListing,
  getListing,
  readThread,
  renewListing,
  report,
  review,
  sendMessage,
  setListingDone,
  toggleSpark,
} from "@/app/actions/listings";
import { endsText, REPORT_REASONS, type Listing, type Thread } from "@/lib/listings";
import { ListingForm } from "./ListingForm";
import { timeAgo } from "./board/parts";
import { input, link, primary, quiet, tag } from "./ui";

// One listing, in full. Photos, name, who and when, each field as a
// heading and its words, labels. Then what you can do: the maker edits,
// marks it done, renews, and answers messages; anyone else sparks,
// messages, comments, reports, or blocks.
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
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const refresh = () => setToken((t) => t + 1);

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

  async function act(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    try {
      await fn();
      after?.();
      refresh();
      onChange?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (missing) return <p className="text-sm text-neutral-500">This was deleted or isn&apos;t shared with you.</p>;
  if (!listing) return <p className="text-sm text-neutral-400">Loading...</p>;

  if (editing) {
    return (
      <ListingForm
        noun="listing"
        fields={listing.fields}
        photoLimit={listing.photoLimit}
        listing={listing}
        onSaved={() => {
          setEditing(false);
          refresh();
          onChange?.();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const l = listing;
  const filled = l.fields.filter((f) => l.values[f.key]);
  const ends = endsText(l.expiresAt);
  const ended = ends === "Ended";

  return (
    <article className="flex flex-col gap-3">
      {l.photos.length > 0 && <Photos photos={l.photos} />}

      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {!compact && <h3 className="text-lg font-semibold leading-snug">{l.name}</h3>}
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
            <span>
              {l.byName} · {timeAgo(l.createdAt)}
            </span>
            {l.done && <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-medium text-neutral-700">Done</span>}
            {!l.done && ends && <span className={ended ? "font-medium text-red-700" : ""}>{ends}</span>}
            {l.hidden && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">Hidden after reports</span>}
          </p>
        </div>
        {l.mine && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-neutral-300 px-3 py-0.5 hover:border-neutral-900">
              Edit
            </button>
            <button
              type="button"
              onClick={() => window.confirm(`Delete "${l.name}"? This can't be undone.`) && act(() => deleteListing(l.id), () => setMissing(true))}
              className="text-neutral-400 hover:text-red-600"
              aria-label="Delete"
            >
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
              <dd className="whitespace-pre-wrap break-words text-sm text-neutral-800">{l.values[f.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {l.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {l.labels.map((x) => (
            <span key={x} className={tag}>
              {x}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {l.mine ? (
          <>
            <button type="button" onClick={() => act(() => setListingDone(l.id, !l.done))} className={quiet}>
              {l.done ? "Open it again" : "Mark done"}
            </button>
            {l.canRenew && !l.done && (
              <button type="button" onClick={() => act(() => renewListing(l.id))} className={quiet}>
                Renew
              </button>
            )}
            {l.sparks > 0 && (
              <span className="text-neutral-500">
                ✦ {l.sparks} spark{l.sparks === 1 ? "" : "s"}
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            aria-pressed={l.sparked}
            onClick={() => act(() => toggleSpark(l.id))}
            className={`rounded-full px-3 py-1.5 font-medium ${l.sparked ? "bg-amber-500 text-white" : "border border-neutral-300 text-neutral-700 hover:border-amber-500"}`}
          >
            ✦ {l.sparked ? "Sparked" : "Spark"}
            {l.sparks > 0 ? ` · ${l.sparks}` : ""}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {l.isModerator && l.hidden && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs">
          <span className="text-red-900">Hidden after reports.</span>
          <button type="button" onClick={() => act(() => review(l.id, null, false))} className={`${quiet} ml-auto bg-white`}>
            Clear, show it again
          </button>
          <button type="button" onClick={() => act(() => review(l.id, null, true), () => setMissing(true))} className={primary}>
            Remove
          </button>
        </div>
      )}

      {l.mine ? (
        l.threads.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-neutral-700">Messages</h4>
            {l.threads.map((t) => (
              <ThreadBox key={t.askerId} listingId={l.id} thread={t} title={t.askerName} onSent={refresh} />
            ))}
          </section>
        )
      ) : (
        !l.blocked && (
          <ThreadBox listingId={l.id} thread={l.threads[0]} title={`Message ${l.byName}`} startClosed onSent={refresh} />
        )
      )}

      <Comments listing={l} onChange={refresh} />

      {!l.mine && <MoreActions listing={l} onDone={refresh} onBlocked={() => (setMissing(true), onChange?.())} />}
    </article>
  );
}

function Photos({ photos }: { photos: { path: string; url: string }[] }) {
  const [i, setI] = useState(0);
  const p = photos[Math.min(i, photos.length - 1)];
  return (
    <div className="flex flex-col gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt="" className="max-h-96 w-full rounded-md bg-neutral-100 object-contain" />
      {photos.length > 1 && (
        <div className="flex gap-1.5">
          {photos.map((x, j) => (
            <button key={x.path} type="button" onClick={() => setI(j)} aria-label={`Photo ${j + 1}`} className={`overflow-hidden rounded ${j === i ? "ring-2 ring-neutral-900" : "opacity-70"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.url} alt="" className="h-12 w-12 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A private thread. Only the two people in it can read it.
function ThreadBox({
  listingId,
  thread,
  title,
  startClosed = false,
  onSent,
}: {
  listingId: string;
  thread?: Thread;
  title: string;
  startClosed?: boolean;
  onSent: () => void;
}) {
  const [open, setOpen] = useState(!startClosed || Boolean(thread));
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const askerId = thread?.askerId ?? "";
  const unread = thread?.unread ?? 0;

  useEffect(() => {
    if (open && thread && unread > 0) readThread(listingId, askerId).catch(() => {});
  }, [open, listingId, askerId, thread, unread]);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      // An empty askerId starts your own thread with the maker.
      await sendMessage(listingId, askerId, body);
      setBody("");
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className={quiet}>
          ✉ {title}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-2.5">
      <p className="flex items-center gap-2 text-xs font-medium text-neutral-700">
        ✉ {title}
        {unread > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">{unread} new</span>}
        <span className="ml-auto font-normal text-neutral-400">Private</span>
      </p>
      {thread && (
        <ul className="flex flex-col gap-1.5">
          {thread.messages.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm ${m.mine ? "self-end bg-neutral-900 text-white" : "self-start bg-neutral-100 text-neutral-800"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`text-[10px] ${m.mine ? "text-neutral-300" : "text-neutral-500"}`}>{timeAgo(m.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message"
          className={`${input} min-w-0 flex-1 resize-none`}
        />
        <button type="button" disabled={sending || !body.trim()} onClick={send} className={primary}>
          Send
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Comments({ listing, onChange }: { listing: Listing; onChange: () => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold text-neutral-700">
        Comments{listing.comments.length > 0 ? ` (${listing.comments.length})` : ""}
      </h4>
      {listing.comments.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {listing.comments.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5 py-1.5">
              <p className="text-xs text-neutral-500">
                <span className="font-medium text-neutral-700">{c.authorName}</span> · {timeAgo(c.createdAt)}
                {c.hidden && <span className="ml-2 text-red-700">hidden after reports</span>}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-neutral-800">{c.body}</p>
              <div className="flex gap-3 text-[11px] text-neutral-400">
                {(c.mine || listing.mine || listing.isModerator) && (
                  <button type="button" onClick={() => window.confirm("Delete this comment?") && run(() => deleteComment(c.id))} className="hover:text-red-600">
                    Delete
                  </button>
                )}
                {!c.mine && (
                  <button type="button" onClick={() => setReporting(reporting === c.id ? null : c.id)} className="hover:text-neutral-700">
                    Report
                  </button>
                )}
                {listing.isModerator && c.hidden && (
                  <button type="button" onClick={() => run(() => review(listing.id, c.id, false))} className="hover:text-neutral-700">
                    Clear
                  </button>
                )}
              </div>
              {reporting === c.id && (
                <ReportForm onSend={(reason, note) => run(() => report(listing.id, c.id, reason, note)).then(() => setReporting(null))} onCancel={() => setReporting(null)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {!listing.done && !listing.blocked && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) run(() => addComment(listing.id, body)).then(() => setBody(""));
          }}
          className="flex items-end gap-2"
        >
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} maxLength={2000} placeholder="Add a comment everyone can see" className={`${input} min-w-0 flex-1 resize-none`} />
          <button type="submit" disabled={!body.trim()} className={quiet}>
            Comment
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}

function MoreActions({ listing, onDone, onBlocked }: { listing: Listing; onDone: () => void; onBlocked: () => void }) {
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-2">
      <div className="flex gap-4 text-[11px] text-neutral-400">
        <button type="button" onClick={() => setReporting(!reporting)} className="hover:text-neutral-700">
          Report
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`Block ${listing.byName}? You won't see anything they share, and neither of you can message the other.`)) return;
            try {
              await blockMaker(listing.id);
              onBlocked();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
          className="hover:text-neutral-700"
        >
          Block {listing.byName}
        </button>
      </div>
      {reporting && (
        <ReportForm
          onCancel={() => setReporting(false)}
          onSend={async (reason, n) => {
            try {
              await report(listing.id, null, reason, n);
              setReporting(false);
              setNote("Thanks. A moderator will look at it.");
              onDone();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      )}
      {note && <p className="text-xs text-green-800">{note}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ReportForm({ onSend, onCancel }: { onSend: (reason: string, note: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("scam");
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={reason === r.key}
            onClick={() => setReason(r.key)}
            className={`rounded-full px-2.5 py-1 ${reason === r.key ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Anything a moderator should know (optional)" className={input} />
      <div className="flex gap-3">
        <button type="button" onClick={() => onSend(reason, note)} className={primary}>
          Send report
        </button>
        <button type="button" onClick={onCancel} className={link}>
          Cancel
        </button>
      </div>
    </div>
  );
}
