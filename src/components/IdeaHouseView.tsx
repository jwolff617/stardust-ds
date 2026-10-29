"use client";

import { useEffect, useState } from "react";
import { IDEA_HOUSE, kindOf } from "@/lib/boards";
import type { Decision, Ledger } from "@/lib/idea-house";
import type { Post } from "@/lib/posts";
import { useBoard, EMPTY_FILTERS } from "./board/useBoard";
import { PostForm } from "./board/PostForm";
import { BoardTop, PostThreads, chip, input, link, primary, quiet, timeAgo, type Send } from "./board/parts";

type House = { ledger: Ledger; decisions: Record<string, Decision>; nextReview: string; publicPage: string };
type Tab = "about" | "apply" | "judge";

const STATUS: Record<Decision["status"], string> = { reviewing: "Reviewing", granted: "Granted", not_this_time: "Not this time" };

// Idea House: the fund's story and public ledger (by ID, never by name),
// a private application, and judges' decisions. Applications are seen only
// by the applicant and the judges (the board's stewards).
export function IdeaHouseView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const { board, loaded, error, send, refresh } = useBoard(dictionary.id, EMPTY_FILTERS, reloadKey);
  // Your own applications, open or closed.
  const yours = useBoard(dictionary.id, { ...EMPTY_FILTERS, view: "mine" }, reloadKey);
  const [house, setHouse] = useState<House | null>(null);
  const [houseToken, setHouseToken] = useState(0);
  const [tab, setTab] = useState<Tab>("about");
  const [applying, setApplying] = useState(false);
  const judge = board.me.isSteward;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/idea-house?dictionaryId=${dictionary.id}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => !data.error && setHouse(data))
      .catch(() => {});
    return () => controller.abort();
  }, [dictionary.id, houseToken, reloadKey]);

  const act: Send = async (body) => {
    const res = await send(body);
    yours.refresh();
    setHouseToken((t) => t + 1);
    return res;
  };
  const actMine: Send = async (body) => {
    const res = await yours.send(body);
    refresh();
    setHouseToken((t) => t + 1);
    return res;
  };

  const mine = yours.board.posts;
  const applications = board.posts.filter((p) => !p.mine);
  const waiting = applications.filter((p) => !house?.decisions[p.id] || house.decisions[p.id].status === "reviewing").length;

  return (
    <div className="flex flex-col gap-3">
      <BoardTop name={dictionary.name} intro={board.intro} safety={IDEA_HOUSE.safety} />

      <div className="flex flex-wrap gap-1.5" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "about"} onClick={() => setTab("about")} className={chip(tab === "about")}>
          The fund and its ledger
        </button>
        <button type="button" role="tab" aria-selected={tab === "apply"} onClick={() => setTab("apply")} className={chip(tab === "apply")}>
          {mine.length > 0 ? `Your application${mine.length > 1 ? "s" : ""}` : "Apply"}
          {mine.some((p) => p.threads.some((t) => t.yourTurn)) && " (new message)"}
        </button>
        {judge && (
          <button type="button" role="tab" aria-selected={tab === "judge"} onClick={() => setTab("judge")} className={chip(tab === "judge")}>
            Applications{waiting > 0 ? ` (${waiting} waiting)` : ""}
          </button>
        )}
      </div>
      {(error ?? yours.error) && <p className="text-sm text-red-700">{error ?? yours.error}</p>}

      {tab === "about" && <About house={house} onApply={() => setTab("apply")} />}

      {tab === "apply" &&
        (!loaded || !yours.loaded ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {mine.map((p) => (
              <YourApplication key={p.id} post={p} decision={house?.decisions[p.id]} send={actMine} />
            ))}
            {applying || mine.length === 0 ? (
              <>
                <p className="text-sm text-neutral-700">
                  A few questions, in your own words. Only you and the fund&apos;s judges will see this. The fund gives things you need (tools, a laptop, a bus pass,
                  materials), not cash.
                  {house?.nextReview ? ` Next review: ${house.nextReview}.` : ""}
                </p>
                <PostForm config={IDEA_HOUSE} board={board} editing={null} send={actMine} onDone={() => setApplying(false)} />
              </>
            ) : (
              <button type="button" className={`${quiet} self-start`} onClick={() => setApplying(true)}>
                Apply again
              </button>
            )}
          </div>
        ))}

      {tab === "judge" && judge && (
        <div className="flex flex-col gap-3">
          {applications.length === 0 ? (
            <p className="text-sm text-neutral-500">No applications yet.</p>
          ) : (
            applications.map((p) => <JudgeCard key={p.id} post={p} decision={house?.decisions[p.id]} send={act} />)
          )}
        </div>
      )}
    </div>
  );
}

function About({ house, onApply }: { house: House | null; onApply: () => void }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-neutral-800">
      <p>
        The Idea House Fund is a Seattle nonprofit, piloted with Recovery Cafe. It gives small grants of things, not money, to people with an idea: a vacuum to start
        cleaning houses, tools for a bike stand, a laptop to write a book. It grew from the Empathy Squared idea in the Evolve dictionary: help one person build their
        idea, and it reaches the people around them.
      </p>
      <p className="text-neutral-600">
        It&apos;s incorporated in Washington (EIN 42-4388998). IRS tax-exempt recognition is still pending, so gifts aren&apos;t tax-deductible yet.
      </p>
      <div>
        <button type="button" className={primary} onClick={onApply}>
          Apply
        </button>
      </div>

      <h4 className="mt-2 text-xs font-medium text-neutral-500">The public ledger</h4>
      <p className="text-xs text-neutral-600">Every grant, by ID number, never by name. People applying are often navigating homelessness, and this list stays that way on purpose.</p>
      {house === null ? (
        <p className="text-xs text-neutral-500">Loading the ledger...</p>
      ) : house.ledger.headers.length === 0 || house.ledger.rows.length === 0 ? (
        <p className="text-xs text-neutral-500">No grants on the ledger yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                {house.ledger.headers.map((h, i) => (
                  <th key={i} className="whitespace-nowrap py-1.5 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {house.ledger.rows.map((r, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  {r.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap py-1.5 pr-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {house?.publicPage && (
        <a href={house.publicPage} target="_blank" rel="noreferrer" className={`${link} self-start`}>
          The fund&apos;s public page
        </a>
      )}
    </div>
  );
}

function Answers({ post: p }: { post: Post }) {
  const kind = kindOf(IDEA_HOUSE, p.kind);
  const rows = [
    ...(p.price ? [{ label: kind?.price?.label ?? "Cost", value: p.price }] : []),
    ...(kind?.fields ?? []).map((f) => ({ label: f.label, value: typeof p.details[f.key] === "string" ? (p.details[f.key] as string) : "" })),
  ].filter((r) => r.value);
  return (
    <div className="flex flex-col gap-1.5">
      <dl className="flex flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-neutral-500">{r.label}</dt>
            <dd className="whitespace-pre-wrap">{r.value}</dd>
          </div>
        ))}
      </dl>
      {p.body && <p className="whitespace-pre-wrap text-sm text-neutral-800">{p.body}</p>}
    </div>
  );
}

function StatusLine({ decision, closed }: { decision: Decision | undefined; closed: boolean }) {
  if (closed && !decision) return <p className="text-sm text-neutral-600">Withdrawn.</p>;
  if (!decision) return <p className="text-sm text-neutral-700">Received. A judge will read it soon.</p>;
  return (
    <div className="flex flex-col gap-0.5">
      <p className={`text-sm font-medium ${decision.status === "granted" ? "text-emerald-800" : "text-neutral-800"}`}>
        {STATUS[decision.status]}
        {decision.status === "granted" && decision.grantId ? `, ${decision.grantId} on the ledger` : ""}
      </p>
      {decision.note && <p className="whitespace-pre-wrap text-sm text-neutral-700">{decision.note}</p>}
    </div>
  );
}

function YourApplication({ post: p, decision, send }: { post: Post; decision: Decision | undefined; send: Send }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold">{p.title}</span>
        <span className="text-xs text-neutral-500">sent {timeAgo(p.createdAt)}</span>
      </div>
      <StatusLine decision={decision} closed={p.status === "closed"} />
      <button type="button" className={`${link} self-start`} onClick={() => setOpen(!open)}>
        {open ? "Hide what you wrote" : "See what you wrote"}
      </button>
      {open && <Answers post={p} />}
      <PostThreads post={p} send={send} emptyMine="No questions from the judges yet. If they have any, they'll show up here." />
      {p.status === "open" && !decision && (
        <button
          type="button"
          className={`${link} self-start`}
          onClick={() => window.confirm("Withdraw your application?") && send({ action: "close", id: p.id, note: "" })}
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

function JudgeCard({ post: p, decision, send }: { post: Post; decision: Decision | undefined; send: Send }) {
  const [status, setStatus] = useState<Decision["status"]>(decision?.status ?? "reviewing");
  const [grantId, setGrantId] = useState(decision?.grantId ?? "");
  const [note, setNote] = useState(decision?.note ?? "");
  const [open, setOpen] = useState(!decision);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-col gap-0.5 text-left">
        <span className="font-semibold">{p.title}</span>
        <span className="text-xs text-neutral-500">
          {[p.authorName, p.price, `sent ${timeAgo(p.createdAt)}`, p.status === "closed" ? "withdrawn" : null].filter(Boolean).join(" · ")}
        </span>
        <span className="text-xs font-medium text-neutral-700">{decision ? STATUS[decision.status] : "Waiting for a judge"}</span>
      </button>
      {open && (
        <>
          <Answers post={p} />
          <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATUS) as Decision["status"][]).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={chip(status === s)}>
                  {STATUS[s]}
                </button>
              ))}
            </div>
            {status === "granted" && (
              <input value={grantId} onChange={(e) => setGrantId(e.target.value)} maxLength={20} placeholder="Ledger ID, like IH-008" className={`${input} w-48`} />
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={status === "not_this_time" ? "A kind note: what would help next time" : "A note to the applicant (they'll see it)"}
              className={input}
            />
            <button type="button" className={`${primary} self-start`} onClick={() => send({ action: "decide", id: p.id, status, grantId, note })}>
              Save decision
            </button>
            <p className="text-xs text-neutral-500">Granted? Add the row to the fund&apos;s sheet by ID only, never the name.</p>
          </div>
          <PostThreads post={p} send={send} startLabel={`Ask ${p.authorName} a question privately`} />
        </>
      )}
    </div>
  );
}
