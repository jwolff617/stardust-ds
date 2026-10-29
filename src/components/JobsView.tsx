"use client";

import { useState } from "react";
import { JOB_MATCH, kindOf } from "@/lib/boards";
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
  chip,
  primary,
  quiet,
  timeAgo,
  type Send,
} from "./board/parts";

const STARTER = "Hi, I'd like to apply.\nI can work: \nWhat I've done: \nThe best way to reach me is here.";

// Job Match: pay up front, fair chance and no-experience filters, apply by
// message, and Looking posts matched to work by label.
export function JobsView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { board, loaded, error, send } = useBoard(dictionary.id, filters, reloadKey);
  const [form, setForm] = useState<{ editing: Post | null; kind?: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fairChance, setFairChance] = useState(false);
  const [noExperience, setNoExperience] = useState(false);
  const [forYou, setForYou] = useState(false);
  const set = (change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change }));

  const hasLooking = board.mineOpen.some((m) => m.kind === "Looking");
  const shown = board.posts.filter(
    (p) =>
      (!fairChance || p.details.fair_chance) &&
      (!noExperience || p.details.experience === "None needed" || p.kind === "Gig" || p.kind === "Training") &&
      (!forYou || matchFor(JOB_MATCH, board, p)),
  );

  return (
    <div className="flex flex-col gap-3">
      <BoardTop
        name={dictionary.name}
        intro={board.intro}
        safety={JOB_MATCH.safety}
        action={
          <div className="flex gap-2">
            <button type="button" className={quiet} onClick={() => setForm({ editing: null, kind: "Looking" })}>
              I&apos;m looking
            </button>
            <button type="button" className={primary} onClick={() => setForm({ editing: null, kind: "Job" })}>
              + Post work
            </button>
          </div>
        }
      />

      {form && (
        <PostForm
          key={`${form.editing?.id ?? "new"}-${form.kind ?? ""}`}
          config={JOB_MATCH}
          board={board}
          editing={form.editing}
          startKind={form.kind}
          send={send}
          onDone={(id) => {
            setForm(null);
            if (id) setOpenId(id);
          }}
        />
      )}

      <ViewTabs view={filters.view} onView={(view) => set({ view })} board={board} names={{ mine: "Your posts" }} />
      {error && <p className="text-sm text-red-700">{error}</p>}

      {filters.view === "all" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={fairChance} onClick={() => setFairChance(!fairChance)} className={chip(fairChance)}>
              Fair chance
            </button>
            <button type="button" aria-pressed={noExperience} onClick={() => setNoExperience(!noExperience)} className={chip(noExperience)}>
              No experience needed
            </button>
            {hasLooking && (
              <button type="button" aria-pressed={forYou} onClick={() => setForYou(!forYou)} className={chip(forYou)}>
                Matches you
              </button>
            )}
          </div>
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
            searchPlaceholder="Search: kitchen, driver, Y"
          />
        </>
      )}

      {filters.view === "review" ? (
        <ReviewList board={board} send={send} render={(p) => <JobCard post={p} />} />
      ) : !loaded ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : shown.length === 0 ? (
        <EmptyNote
          view={filters.view}
          empty={board.posts.length > 0 ? "Nothing fits those filters right now." : "No posts yet. If you're looking for work, post what you want: employers can find you."}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((p) => {
            const match = matchFor(JOB_MATCH, board, p);
            const open = openId === p.id;
            return (
              <li key={p.id} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
                <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open} className="text-left">
                  <JobCard post={p} match={match ? `Matches your Looking post: #${match.shared.join(" #")}` : null} />
                </button>
                {open && <JobDetail post={p} send={send} onEdit={() => setForm({ editing: p })} />}
              </li>
            );
          })}
        </ul>
      )}

      <BlockedList board={board} send={send} />
    </div>
  );
}

function JobCard({ post: p, match }: { post: Post; match?: string | null }) {
  const kind = kindOf(JOB_MATCH, p.kind);
  const d = p.details as Record<string, string | undefined>;
  const facts = p.kind === "Looking" ? [d.work, d.available] : p.kind === "Gig" ? [d.when, d.length] : p.kind === "Training" ? [d.when, d.length] : [d.hours, d.schedule];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="rounded bg-neutral-100 px-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">{p.kind}</span>
        <span className={`font-semibold ${p.status === "closed" ? "text-neutral-400 line-through" : ""}`}>{p.title}</span>
        {p.status === "closed" && <span className="text-xs text-neutral-500">{kind?.close.done ?? "Closed"}</span>}
      </div>
      {p.price && <p className="text-base font-semibold text-emerald-800">{p.price}</p>}
      <p className="text-sm text-neutral-700">{facts.filter(Boolean).join(" · ")}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {d.fair_chance && <span className="rounded bg-emerald-100 px-1.5 font-medium text-emerald-900">Fair chance</span>}
        {d.experience === "None needed" && <span className="rounded bg-sky-100 px-1.5 font-medium text-sky-900">No experience needed</span>}
        {d.answer && <span className="rounded bg-neutral-100 px-1.5 text-neutral-700">Answers {d.answer.toLowerCase()}</span>}
        <OrgBadge org={p.organization} />
        <span className="text-neutral-500">{[p.neighborhood, p.mine ? "You" : p.organization ? null : p.authorName, timeAgo(p.createdAt)].filter(Boolean).join(" · ")}</span>
      </div>
      {match && <p className="text-xs font-medium text-blue-700">{match}</p>}
      {p.hidden && <p className="text-xs text-red-700">{p.review === "removed" ? "Removed by a steward." : "Hidden after reports. A steward will look at it."}</p>}
      {p.mine && p.expired && <p className="text-xs text-amber-800">Expired. Renew it to put it back up.</p>}
      {p.threads.some((t) => t.yourTurn) && <p className="text-xs font-medium text-blue-700">Your turn to answer</p>}
    </div>
  );
}

function JobDetail({ post: p, send, onEdit }: { post: Post; send: Send; onEdit: () => void }) {
  const kind = kindOf(JOB_MATCH, p.kind);
  const d = p.details as Record<string, string | undefined>;
  const skip = new Set(["fair_chance", "apply", "apply_where", "answer"]);
  const fields = (kind?.fields ?? [])
    .filter((f) => !skip.has(f.key))
    .map((f) => ({ label: f.label, value: d[f.key] }))
    .filter((f): f is { label: string; value: string } => Boolean(f.value));
  const applyByMessage = p.kind !== "Job" || !d.apply || d.apply === "Message here";
  const where = d.apply_where ?? "";
  return (
    <div className="flex flex-col gap-2.5">
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
      <Labels labels={p.labels} />
      {p.kind === "Job" && d.apply && d.apply !== "Message here" && (
        <p className="text-sm">
          <span className="font-medium">How to apply: {d.apply}.</span>{" "}
          {/^https?:\/\//.test(where) ? (
            <a href={where} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              {where}
            </a>
          ) : (
            where
          )}{" "}
          <span className="text-neutral-500">You can also message them here.</span>
        </p>
      )}
      {p.mine ? <OwnerActions post={p} kind={kind} send={send} onEdit={onEdit} /> : <OtherActions post={p} send={send} />}
      <PostThreads
        post={p}
        send={send}
        emptyMine={p.kind === "Looking" ? "No messages yet. Employers who write to you show up here." : "No applications yet. They show up here, one conversation each."}
        startLabel={p.kind === "Looking" ? `Message ${p.authorName} about work` : applyByMessage ? "Apply with a message" : undefined}
        starter={p.kind === "Job" || p.kind === "Gig" ? STARTER : undefined}
      />
    </div>
  );
}
