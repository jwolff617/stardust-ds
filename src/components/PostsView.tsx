"use client";

import { useEffect, useState } from "react";
import type { Post, PostKind, Thread } from "@/lib/posts";

type Board = { kinds: PostKind[]; labels: string[]; posts: Post[] };
type Draft = { kind: string; title: string; body: string; neighborhood: string; price: string; labels: string };

const EMPTY: Draft = { kind: "", title: "", body: "", neighborhood: "", price: "", labels: "" };

// A board's Display View (Marketplace first): filter by kind and label,
// search, post, and reply privately. Report and Block on every post.
export function PostsView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [board, setBoard] = useState<Board>({ kinds: [], labels: [], posts: [] });
  const [kinds, setKinds] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId: dictionary.id, kinds: kinds.join(","), labels: labels.join(","), q });
    if (mine) params.set("mine", "1");
    const timer = setTimeout(() => {
      fetch(`/api/posts?${params}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setBoard(data);
        })
        .catch((err) => {
          if ((err as Error).name !== "AbortError") setError((err as Error).message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dictionary.id, kinds, labels, q, mine, refreshToken, reloadKey]);

  async function send(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dictionaryId: dictionary.id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return false;
    }
    setRefreshToken((t) => t + 1);
    return true;
  }

  async function save() {
    if (!draft) return;
    const ok = await send({ action: editingId ? "edit" : "add", id: editingId, post: draft });
    if (ok) {
      setDraft(null);
      setEditingId(null);
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-0.5 text-xs ${on ? "bg-blue-600 text-white" : "border border-neutral-300 text-neutral-600"}`;
  const input = "rounded border border-neutral-300 px-2 py-1 text-sm";
  const kindHelp = board.kinds.find((k) => k.name === draft?.kind)?.description;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setDraft(draft ? null : { ...EMPTY, kind: board.kinds[0]?.name ?? "" });
          }}
          className="ml-auto rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white"
        >
          {draft && !editingId ? "Cancel" : "+ New post"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && (
        <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
          <div className="flex flex-wrap gap-1.5">
            {board.kinds.map((k) => (
              <button key={k.name} type="button" onClick={() => setDraft({ ...draft, kind: k.name })} className={chip(draft.kind === k.name)}>
                {k.name}
              </button>
            ))}
          </div>
          {kindHelp && <p className="text-xs text-neutral-500">{kindHelp}</p>}
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" maxLength={120} className={input} />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Details"
            rows={4}
            maxLength={5000}
            className={input}
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="Price ($40, free, offer)"
              maxLength={40}
              className={`${input} w-44`}
            />
            <input
              value={draft.neighborhood}
              onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
              placeholder="Neighborhood"
              maxLength={60}
              className={`${input} w-44`}
            />
            <input
              value={draft.labels}
              onChange={(e) => setDraft({ ...draft, labels: e.target.value })}
              placeholder="Labels: bike, furniture, kids"
              className={`${input} min-w-0 flex-1`}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
              {editingId ? "Save" : "Post"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
              }}
              className="text-xs text-neutral-500 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-xs text-neutral-500">Kind</span>
          {board.kinds.map((k) => (
            <button key={k.name} type="button" aria-pressed={kinds.includes(k.name)} onClick={() => toggle(kinds, setKinds, k.name)} className={chip(kinds.includes(k.name))}>
              {k.name}
            </button>
          ))}
          <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)} className={`${chip(mine)} ml-2`}>
            My posts
          </button>
        </div>
        {(board.labels.length > 0 || labels.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 text-xs text-neutral-500">Labels</span>
            {[...new Set([...labels, ...board.labels])].map((l) => (
              <button key={l} type="button" aria-pressed={labels.includes(l)} onClick={() => toggle(labels, setLabels, l)} className={chip(labels.includes(l))}>
                #{l}
              </button>
            ))}
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" className={`${input} max-w-sm`} />
      </div>

      {board.posts.length === 0 ? (
        <p className="text-sm text-neutral-400">{mine ? "You haven't posted yet." : "No posts here yet. Be the first."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {board.posts.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 py-3">
              <button type="button" onClick={() => setOpenId(openId === p.id ? null : p.id)} className="flex flex-wrap items-baseline gap-x-2 text-left">
                <span className="rounded bg-neutral-100 px-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">{p.kind}</span>
                <span className={`font-medium ${p.status === "closed" ? "text-neutral-400 line-through" : ""}`}>{p.title}</span>
                {p.price && <span className="text-sm font-semibold">{p.price}</span>}
                <span className="text-xs text-neutral-500">
                  {[p.neighborhood, p.mine ? "you" : p.authorName, new Date(p.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}
                </span>
                {p.hidden && <span className="text-xs text-red-600">Hidden after reports</span>}
                {p.threads.length > 0 && (
                  <span className="text-xs text-blue-700">
                    {p.threads.reduce((n, t) => n + t.replies.length, 0)} repl{p.threads.length === 1 && p.threads[0].replies.length === 1 ? "y" : "ies"}
                  </span>
                )}
              </button>

              {openId === p.id && (
                <div className="flex flex-col gap-2 pl-1">
                  {p.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{p.body}</p>}
                  {p.labels.length > 0 && <p className="text-xs text-neutral-500">{p.labels.map((l) => `#${l}`).join(" ")}</p>}

                  {p.mine ? (
                    <>
                      {p.threads.length === 0 && <p className="text-xs text-neutral-400">No replies yet.</p>}
                      {p.threads.map((t) => (
                        <ThreadBox key={t.replierId} thread={t} title={`From ${t.replierName || "a spark"}`} onSend={(text) => send({ action: "reply", id: p.id, body: text, replierId: t.replierId })} onBlock={() => window.confirm("Block this spark? They can't reply to you or see your posts.") && send({ action: "block", id: p.id, replierId: t.replierId })} />
                      ))}
                      <div className="flex flex-wrap gap-3 text-xs">
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setEditingId(p.id);
                            setDraft({ kind: p.kind, title: p.title, body: p.body, neighborhood: p.neighborhood, price: p.price, labels: p.labels.join(", ") });
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="underline" onClick={() => send({ action: p.status === "open" ? "close" : "reopen", id: p.id })}>
                          {p.status === "open" ? "Mark closed" : "Reopen"}
                        </button>
                        <button type="button" className="ml-4 text-red-600 underline" onClick={() => window.confirm("Delete this post and its replies?") && send({ action: "delete", id: p.id })}>
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <ThreadBox
                        thread={p.threads[0] ?? { replierId: "", replierName: "", replies: [] }}
                        title={`Reply privately to ${p.authorName}`}
                        onSend={(text) => send({ action: "reply", id: p.id, body: text })}
                      />
                      <div className="flex gap-4 text-xs text-neutral-500">
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            const reason = window.prompt("What's wrong with this post? (scam, unsafe, breaks the rules)");
                            if (reason !== null) send({ action: "report", id: p.id, reason }).then((ok) => ok && window.alert("Thanks. Three reports hide a post."));
                          }}
                        >
                          Report
                        </button>
                        <button type="button" className="underline" onClick={() => window.confirm(`Block ${p.authorName}? You won't see their posts and they can't reply to you.`) && send({ action: "block", id: p.id })}>
                          Block
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ThreadBox({ thread, title, onSend, onBlock }: { thread: Thread; title: string; onSend: (text: string) => Promise<boolean>; onBlock?: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-neutral-200 p-2">
      <div className="flex items-center text-xs font-medium text-neutral-500">
        {title}
        {onBlock && (
          <button type="button" onClick={onBlock} className="ml-auto font-normal underline">
            Block
          </button>
        )}
      </div>
      {thread.replies.map((r) => (
        <p key={r.id} className={`text-sm ${r.mine ? "text-neutral-900" : "text-blue-900"}`}>
          <span className="mr-1 text-xs text-neutral-400">{r.mine ? "You" : r.senderName || "Them"}:</span>
          {r.body}
        </p>
      ))}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && onSend(text).then((ok) => ok && setText(""))}
          placeholder="Write a reply"
          maxLength={2000}
          className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onSend(text).then((ok) => ok && setText(""))}
          className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
