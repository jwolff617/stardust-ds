"use client";

import { useEffect, useState } from "react";
import { answerNotice, clearNotice, inboxThreads, markNoticeRead, myNotices, sendHello, threadMessages, type Message, type Notice, type Thread } from "@/app/actions/words";
import { getSwap, offerContact, withdrawContact } from "@/app/actions/swaps";

// Inbox: invites and notices. Talking happens in group journals; older
// hello threads stay below so nothing is lost.
export function InboxView({ reloadKey = 0, onOpenGroup }: { reloadKey?: number; onOpenGroup?: (id: string) => void }) {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [nToken, setNToken] = useState(0);
  useEffect(() => {
    myNotices().then(setNotices).catch(() => setNotices([]));
  }, [reloadKey, nToken]);

  return (
    <div className="flex flex-col gap-6 pr-6">
      <section className="flex flex-col gap-2">
        {notices === null ? (
          <p className="text-sm opacity-50">Opening your inbox...</p>
        ) : notices.length === 0 ? (
          <p className="text-sm opacity-60">No invites or notices. Event invites and people who connect with your matches land here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {notices.map((n) => (
              <NoticeRow
                key={n.id}
                n={n}
                onOpen={(id) => {
                  markNoticeRead(n.id).catch(() => {});
                  onOpenGroup?.(id);
                }}
                onChanged={() => setNToken((t) => t + 1)}
              />
            ))}
          </ul>
        )}
      </section>
      <OldThreads reloadKey={reloadKey} />
    </div>
  );
}

function NoticeRow({ n, onOpen, onChanged }: { n: Notice; onOpen: (id: string) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = n.kind === "invite" ? "invited you to" : n.kind === "connect" ? "wants to connect about" : "";
  async function answer(yes: boolean) {
    setBusy(true);
    setError(null);
    try {
      const id = await answerNotice(n.id, yes);
      onChanged();
      if (yes && id) onOpen(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex flex-col gap-1 py-3">
      <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className={n.read ? "" : "font-semibold"}>{n.fromName || "A spark"}</span>
        {label && <span className="opacity-60">{label}</span>}
        <span className="font-medium">{n.title}</span>
      </span>
      {n.body && <span className="text-sm opacity-70">{n.body}</span>}
      <span className="flex flex-wrap gap-3 text-xs">
        {(n.kind === "invite" || n.kind === "connect") && !n.answer && (
          <>
            <button type="button" disabled={busy} onClick={() => answer(true)} className="underline">
              {n.kind === "invite" ? "Yes, I'll come" : "Yes, open our journal"}
            </button>
            <button type="button" disabled={busy} onClick={() => answer(false)} className="underline opacity-60">
              No, thank you
            </button>
          </>
        )}
        {n.answer && <span className="opacity-60">You said {n.answer}.</span>}
        {n.dictionaryId && (n.answer === "yes" || n.kind === "notice") && (
          <button type="button" onClick={() => onOpen(n.dictionaryId!)} className="underline">
            Open
          </button>
        )}
        <button type="button" onClick={() => clearNotice(n.id).then(onChanged)} className="opacity-50 hover:opacity-100">
          Clear
        </button>
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}

function OldThreads({ reloadKey }: { reloadKey: number }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [open, setOpen] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    inboxThreads()
      .then(setThreads)
      .catch((err) => setError((err as Error).message));
  }, [reloadKey, token]);

  if (open) return <ThreadView thread={open} onBack={() => { setOpen(null); setToken((t) => t + 1); }} />;
  if (!threads) return error ? <p className="text-sm opacity-50">{error}</p> : null;
  if (threads.length === 0) return null;

  return (
    <section className="flex flex-col gap-1">
    <p className="text-xs opacity-50">Earlier messages</p>
    <ul className="flex flex-col divide-y divide-[var(--line)]">
      {threads.map((t) => (
        <li key={`${t.entryId}:${t.askerId}`}>
          <button type="button" onClick={() => setOpen(t)} className="flex w-full flex-col gap-0.5 py-3 text-left hover:opacity-70">
            <span className="flex items-baseline gap-2">
              <span className={t.unread ? "font-semibold" : ""}>{t.withName}</span>
              <span className="text-xs opacity-50">about {t.entryWord}{t.mine ? " (yours)" : ""}</span>
              {t.unread > 0 && <span className="rounded-full bg-[var(--foreground)] px-2 text-[10px] text-[var(--background)]">{t.unread}</span>}
            </span>
            <span className="line-clamp-1 text-sm opacity-70">{t.last}</span>
          </button>
        </li>
      ))}
    </ul>
    </section>
  );
}

function ThreadView({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [swap, setSwap] = useState<{ mine: string | null; theySaidYes: boolean; theirs: string | null } | null>(null);
  const [phone, setPhone] = useState("");
  const swapThread = `e:${thread.entryId}:${thread.askerId}`;

  useEffect(() => {
    threadMessages(thread.entryId, thread.askerId)
      .then(setMessages)
      .catch((err) => setError((err as Error).message));
    getSwap(swapThread).then(setSwap).catch(() => setSwap(null));
  }, [thread, token, swapThread]);

  async function send() {
    if (!text.trim()) return;
    setError(null);
    try {
      await sendHello(thread.entryId, text.trim(), thread.mine ? thread.askerId : undefined);
      setText("");
      setToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3 pr-6">
      <button type="button" onClick={onBack} className="self-start text-xs tracking-widest opacity-60 hover:opacity-100">
        ← INBOX
      </button>
      <p className="text-sm opacity-70">
        {thread.withName} · about {thread.entryWord}
      </p>
      <ul className="flex flex-col gap-2">
        {(messages ?? []).map((m, i) => (
          <li key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.mine ? "self-end bg-[var(--foreground)] text-[var(--background)]" : "self-start bg-[var(--soft)]"}`}>
            {m.body}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="Write back"
          aria-label="Message"
          className="min-w-0 flex-1 resize-none rounded border border-[var(--line)] p-2 text-sm outline-none"
        />
        <button type="button" onClick={send} disabled={!text.trim()} className="rounded bg-[var(--foreground)] px-4 text-sm text-[var(--background)] disabled:opacity-30">
          Send
        </button>
      </div>
      {swap && (
        <div className="rounded border border-[var(--line)] p-2 text-xs">
          {swap.theirs ? (
            <p>Their number: <span className="font-semibold">{swap.theirs}</span></p>
          ) : swap.mine ? (
            <p>
              You offered {swap.mine}. {swap.theySaidYes ? "" : "It shows once they offer theirs."}{" "}
              <button type="button" className="underline" onClick={() => withdrawContact(swapThread).then(() => setToken((t) => t + 1))}>
                Take it back
              </button>
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span>{swap.theySaidYes ? "They're ready to swap numbers." : "Swap numbers when you're both ready."}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your number" aria-label="Your number" className="rounded border border-[var(--line)] px-2 py-0.5" />
              <button
                type="button"
                className="underline"
                onClick={() => offerContact(swapThread, phone).then(() => setToken((t) => t + 1)).catch((err) => setError((err as Error).message))}
              >
                Offer
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
