"use client";

import { useState } from "react";
import { MANIFESTO_MATCH, MANIFESTO_WORDS, kindOf, type Line } from "@/lib/boards";
import type { Post } from "@/lib/posts";
import { NEIGHBORHOODS } from "@/lib/seattle";
import { useBoard, EMPTY_FILTERS, type Filters } from "./board/useBoard";
import { FieldInput } from "./board/PostForm";
import { AdultGate, BlockedList, BoardTop, EmptyNote, OtherActions, PostThreads, ReviewList, ViewTabs, chip, input, link, primary, quiet, timeAgo, type Send } from "./board/parts";

const linesOf = (p: Post): Line[] => (Array.isArray(p.details.lines) ? (p.details.lines as Line[]) : []);
const str = (p: Post, key: string) => (typeof p.details[key] === "string" ? (p.details[key] as string) : "");

// Dating fits both ways: who each hopes to meet, and each age in the other's range.
function datingFits(a: Post, b: Post): boolean {
  const wants = (meet: string, iam: string) => meet === "Everyone" || (meet === "Women" && iam === "A woman") || (meet === "Men" && iam === "A man");
  const inRange = (age: string, min: string, max: string) => Number(age) >= Number(min) && Number(age) <= Number(max);
  return (
    wants(str(a, "meet"), str(b, "iam")) &&
    wants(str(b, "meet"), str(a, "iam")) &&
    inRange(str(b, "age"), str(a, "age_min"), str(a, "age_max")) &&
    inRange(str(a, "age"), str(b, "age_min"), str(b, "age_max"))
  );
}

// Manifesto Match: pick your words, say what each means to you, and meet
// people who share them. 18+ for the whole board; you see others in a kind
// only while your own manifesto for it is up.
export function ManifestoView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [kindName, setKindName] = useState("Friends");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, kinds: ["Friends"] });
  const main = useBoard(dictionary.id, filters, reloadKey);
  const mineBoard = useBoard(dictionary.id, { ...EMPTY_FILTERS, view: "mine" }, reloadKey);
  const [editing, setEditing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const board = main.board;

  // Changes to your own manifesto reload both lists.
  const sendMine: Send = async (body) => {
    const res = await mineBoard.send(body);
    main.refresh();
    return res;
  };
  const sendMain: Send = async (body) => {
    const res = await main.send(body);
    mineBoard.refresh();
    return res;
  };

  const pickKind = (name: string) => {
    setKindName(name);
    setEditing(false);
    setOpenId(null);
    setFilters((f) => ({ ...f, kinds: [name] }));
  };

  const kind = board.kinds.find((k) => k.name === kindName);
  const mine = mineBoard.board.posts.find((p) => p.kind === kindName) ?? null;
  const error = main.error ?? mineBoard.error;

  if (main.loaded && !board.me.adultConfirmed) {
    return (
      <div className="flex flex-col gap-3">
        <BoardTop name={dictionary.name} intro={board.intro} safety={[]} />
        <AdultGate rules={MANIFESTO_MATCH.safety} send={sendMain} />
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  const myWords = new Set(mine ? linesOf(mine).map((l) => l.word) : []);
  const others = board.posts
    .filter((p) => !p.mine && p.kind === kindName && (kindName !== "Dating" || (mine && datingFits(mine, p))))
    .map((p) => ({ post: p, shared: linesOf(p).filter((l) => myWords.has(l.word)) }))
    .sort((a, b) => b.shared.length - a.shared.length || b.post.createdAt.localeCompare(a.post.createdAt));

  return (
    <div className="flex flex-col gap-3">
      <BoardTop name={dictionary.name} intro={board.intro} safety={MANIFESTO_MATCH.safety} />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="What you're looking for">
        {board.kinds.map((k) => (
          <button key={k.name} type="button" role="tab" aria-selected={kindName === k.name} onClick={() => pickKind(k.name)} className={chip(kindName === k.name)}>
            {k.name}
            {!k.open && " (soon)"}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}

      {!main.loaded || !mineBoard.loaded ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : kind && !kind.open && !mine ? (
        <p className="text-sm text-neutral-600">{kind.name} opens soon. Friends and Business Partners are open now.</p>
      ) : editing || !mine ? (
        <ManifestoEditor
          kindName={kindName}
          existing={mine}
          send={sendMine}
          onDone={() => setEditing(false)}
          onCancel={mine ? () => setEditing(false) : undefined}
        />
      ) : (
        <>
          <YourManifesto post={mine} send={sendMine} onEdit={() => setEditing(true)} />
          {mine.status === "closed" ? (
            <p className="text-sm text-neutral-600">Yours is paused, so you don&apos;t show up and you won&apos;t see others here. Unpause when you&apos;re ready.</p>
          ) : (
            <>
              <ViewTabs view={filters.view} onView={(view) => setFilters((f) => ({ ...f, view }))} board={board} names={{ all: "Matches", mine: "Yours" }} />
              {filters.view === "review" ? (
                <ReviewList board={board} send={sendMain} render={(p) => <p className="font-medium">{p.title} · {p.authorName}</p>} />
              ) : filters.view === "mine" ? (
                <p className="text-sm text-neutral-600">Your manifesto is above.</p>
              ) : others.length === 0 ? (
                <EmptyNote
                  view={filters.view}
                  empty={kindName === "Dating" ? "Nobody here fits both ways yet. New people join all the time." : "Nobody else is here yet. You'll be the first person the next one sees."}
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {others.map(({ post: p, shared }) => (
                    <MatchCard
                      key={p.id}
                      post={p}
                      shared={shared}
                      open={openId === p.id}
                      onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                      send={sendMain}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      <BlockedList board={board} send={sendMain} />
    </div>
  );
}

function YourManifesto({ post: p, send, onEdit }: { post: Post; send: Send; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-neutral-50 p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-medium text-neutral-500">Yours</span>
        <span className="font-semibold">{p.title}</span>
        {p.status === "closed" && <span className="text-xs text-amber-800">Paused</span>}
        {p.hidden && <span className="text-xs text-red-700">Hidden after reports. A steward will look at it.</span>}
      </div>
      <p className="text-xs text-neutral-600">{linesOf(p).map((l) => l.word).join(" · ")}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={link} onClick={onEdit}>
          Edit
        </button>
        <button type="button" className={link} onClick={() => send({ action: p.status === "open" ? "close" : "reopen", id: p.id, note: "" })}>
          {p.status === "open" ? "Pause" : "Unpause"}
        </button>
        <button type="button" className={`${link} text-red-700`} onClick={() => window.confirm("Delete your manifesto and its messages for good?") && send({ action: "delete", id: p.id })}>
          Delete
        </button>
      </div>
    </div>
  );
}

function MatchCard({ post: p, shared, open, onToggle, send }: { post: Post; shared: Line[]; open: boolean; onToggle: () => void; send: Send }) {
  const lines = linesOf(p);
  const sharedWords = new Set(shared.map((l) => l.word));
  const excerpt = shared.find((l) => l.text) ?? lines.find((l) => l.text);
  const kind = kindOf(MANIFESTO_MATCH, p.kind);
  const facts = (kind?.fields ?? [])
    .filter((f) => f.type !== "lines" && !["age_min", "age_max", "iam", "meet"].includes(f.key))
    .map((f) => ({ label: f.label, value: str(p, f.key) }))
    .filter((f) => f.value);
  const starter = excerpt ? `Hi ${p.authorName}. You wrote about ${excerpt.word}: "${excerpt.text.slice(0, 80)}${excerpt.text.length > 80 ? "..." : ""}" ` : undefined;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex flex-col gap-1 text-left">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{p.authorName}</span>
          <span className="text-xs text-neutral-500">{[p.kind === "Dating" ? str(p, "age") : null, p.neighborhood].filter(Boolean).join(" · ")}</span>
          <span className="ml-auto text-xs font-medium text-emerald-800">
            {shared.length === 0 ? "No shared words yet" : `${shared.length} shared word${shared.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <p className="text-sm text-neutral-800">{p.title}</p>
        <div className="flex flex-wrap gap-1">
          {lines.map((l) => (
            <span key={l.word} className={`rounded-full px-2 py-0.5 text-xs ${sharedWords.has(l.word) ? "bg-emerald-100 font-medium text-emerald-900" : "bg-neutral-100 text-neutral-600"}`}>
              {l.word}
            </span>
          ))}
        </div>
        {excerpt && !open && (
          <p className="text-sm italic text-neutral-600">
            &ldquo;{excerpt.text}&rdquo; <span className="not-italic text-xs text-neutral-500">on {excerpt.word}</span>
          </p>
        )}
        {p.threads.some((t) => t.yourTurn) && <p className="text-xs font-medium text-blue-700">Your turn to answer</p>}
      </button>

      {open && (
        <div className="flex flex-col gap-2.5">
          <dl className="flex flex-col gap-1.5 text-sm">
            {lines.map((l) => (
              <div key={l.word}>
                <dt className={`font-medium ${sharedWords.has(l.word) ? "text-emerald-900" : ""}`}>{l.word}</dt>
                <dd className="text-neutral-700">{l.text || <span className="text-neutral-400">No line yet.</span>}</dd>
              </div>
            ))}
          </dl>
          {p.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{p.body}</p>}
          {facts.length > 0 && (
            <p className="text-xs text-neutral-600">
              {facts.map((f) => `${f.label}: ${f.value}`).join(" · ")} · here since {timeAgo(p.createdAt)}
            </p>
          )}
          <OtherActions post={p} send={send} />
          <PostThreads post={p} send={send} startLabel={`Say hello to ${p.authorName}`} starter={starter} />
        </div>
      )}
    </li>
  );
}

function ManifestoEditor({
  kindName,
  existing,
  send,
  onDone,
  onCancel,
}: {
  kindName: string;
  existing: Post | null;
  send: Send;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const kind = kindOf(MANIFESTO_MATCH, kindName);
  const linesField = kind?.fields.find((f) => f.type === "lines");
  const min = linesField?.min ?? 5;
  const max = linesField?.max ?? 12;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [neighborhood, setNeighborhood] = useState(existing?.neighborhood ?? "");
  const [lines, setLines] = useState<Line[]>(existing ? linesOf(existing) : []);
  const [details, setDetails] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(existing?.details ?? {})) if (typeof v === "string") out[k] = v;
    return out;
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const picked = new Set(lines.map((l) => l.word));
  const toggleWord = (word: string) =>
    setLines((ls) => (ls.some((l) => l.word === word) ? ls.filter((l) => l.word !== word) : ls.length >= max ? ls : [...ls, { word, text: "" }]));

  async function save() {
    setProblem(null);
    if (lines.length < min) return setProblem(`Pick at least ${min} words.`);
    if (lines.filter((l) => l.text.trim()).length < Math.min(3, lines.length)) return setProblem("Write a line for at least three of your words. That's what people match with.");
    if (kindName === "Dating" && Number(details.age_min) > Number(details.age_max)) return setProblem("Check the ages you're open to: the first should be the lower one.");
    setSaving(true);
    const post = { kind: kindName, title, body, neighborhood, labels: [], details: { ...details, lines } };
    const res = await send(existing ? { action: "edit", id: existing.id, post } : { action: "add", post });
    setSaving(false);
    if (res) onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3"
    >
      <p className="text-sm text-neutral-700">
        {existing ? "Change your manifesto." : `Write your ${kindName} manifesto. Once it's up, you'll see others here, and they'll see you.`}
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind?.titlePlaceholder} aria-label="Headline" maxLength={120} required className={input} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-neutral-600">
          Pick {min} to {max} words that matter most to you. Picked: {lines.length}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MANIFESTO_WORDS.map((w) => (
            <button key={w} type="button" aria-pressed={picked.has(w)} onClick={() => toggleWord(w)} className={chip(picked.has(w))}>
              {w}
            </button>
          ))}
        </div>
      </div>

      {lines.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-600">What each word means to you, in a sentence or two.</p>
          {lines.map((l) => (
            <label key={l.word} className="flex flex-col gap-1 text-sm font-medium">
              {l.word}
              <textarea
                value={l.text}
                onChange={(e) => setLines((ls) => ls.map((x) => (x.word === l.word ? { ...x, text: e.target.value } : x)))}
                rows={2}
                maxLength={280}
                placeholder={`What ${l.word} means to you`}
                className={`${input} font-normal`}
              />
            </label>
          ))}
        </div>
      )}

      {kind?.fields
        .filter((f) => f.type !== "lines")
        .map((f) => (
          <FieldInput key={f.key} field={f} value={details[f.key] ?? ""} onChange={(v) => setDetails((d) => ({ ...d, [f.key]: v }))} />
        ))}

      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind?.bodyPlaceholder} aria-label="About you" rows={3} maxLength={5000} className={input} />
      <input
        value={neighborhood}
        onChange={(e) => setNeighborhood(e.target.value)}
        placeholder="Neighborhood"
        aria-label="Neighborhood"
        list="manifesto-neighborhoods"
        maxLength={60}
        className={`${input} sm:w-48`}
      />
      <datalist id="manifesto-neighborhoods">
        {NEIGHBORHOODS.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <p className="text-xs text-neutral-500">Your name shows as it is on your profile. Skip your last name, phone, and address: share those in messages when you&apos;re ready.</p>

      {problem && <p className="text-sm text-red-700">{problem}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !title.trim()} className={primary}>
          {existing ? "Save" : "Put it up"}
        </button>
        {onCancel && (
          <button type="button" className={quiet} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
