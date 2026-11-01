"use client";

import { useEffect, useState } from "react";
import { IDEA_INDEX } from "@/lib/boards";
import type { Comment, Join, Post } from "@/lib/posts";
import { BoardView } from "./board/BoardView";
import { ReportPanel, input, link, primary, quiet, timeAgo, type Send } from "./board/parts";

// Idea Index on the shared board layout, plus what only ideas have: a spark
// beside each idea (no downvotes), and under an open idea, who's in and the
// open comments.
export function IdeasView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  return (
    <BoardView
      dictionary={dictionary}
      reloadKey={reloadKey}
      config={IDEA_INDEX}
      sorts
      side={(p, send) => <SparkButton post={p} send={send} />}
      extra={(p, send) => <IdeaExtras post={p} send={send} />}
    />
  );
}

// Who's in and the comments load when an idea opens.
function IdeaExtras({ post: p, send }: { post: Post; send: Send }) {
  const [extras, setExtras] = useState<{ comments: Comment[]; joins: Join[] } | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/posts/extras?postId=${p.id}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => !data.error && setExtras(data))
      .catch(() => {});
    return () => controller.abort();
  }, [p.id, token, p.commentCount, p.joinCount]);

  const act: Send = async (body) => {
    const res = await send(body);
    setToken((t) => t + 1);
    return res;
  };

  return (
    <>
      <WhosIn post={p} joins={extras?.joins ?? []} send={act} />
      <Comments post={p} comments={extras?.comments ?? null} send={act} />
    </>
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
