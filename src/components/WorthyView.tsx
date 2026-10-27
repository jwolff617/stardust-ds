"use client";

import { useEffect, useState, useTransition } from "react";
import { TIME_FRAME_LABELS, rangeStart, type TimeFrame } from "@/lib/time-frames";
import {
  BET_OUTCOMES,
  BET_OUTCOME_LABELS,
  PRINCIPLES,
  PRINCIPLE_LABELS,
  PRINCIPLE_SHORT,
  WORTHY_KINDS,
  WORTHY_KIND_LABELS,
  summarize,
  type BetOutcome,
  type Principle,
  type WorthyKind,
} from "@/lib/worthy";

type WorthyDictionary = { id: string; name: string };
type Entry = { id: string; kind: WorthyKind; amount: number; note: string | null; occurredAt: string };
type Story = { id: string; occurredOn: string; outcome: BetOutcome; body: string; principles: Principle[] };

const RANGES: TimeFrame[] = ["day", "week", "month", "year", "decade", "life"];

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function pct(n: number | null): string {
  return n === null ? "n/a" : `${n}%`;
}

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Something went wrong.");
  }
}

// Worthy DS Display View: save half of every win. Only new deposits or
// the other half of wins get re-bet, so every win locks in savings.
export function WorthyView({ dictionary, reloadKey = 0 }: { dictionary: WorthyDictionary; reloadKey?: number }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [range, setRange] = useState<TimeFrame>("life");
  const [refreshToken, setRefreshToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const [kind, setKind] = useState<WorthyKind>("deposit");
  const [amount, setAmount] = useState("");
  const [entryNote, setEntryNote] = useState("");

  const [storyDate, setStoryDate] = useState(today);
  const [storyOutcome, setStoryOutcome] = useState<BetOutcome>("win");
  const [storyBody, setStoryBody] = useState("");
  const [storyPrinciples, setStoryPrinciples] = useState<Principle[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    startLoading(async () => {
      try {
        const res = await fetch(`/api/worthy?dictionaryId=${dictionary.id}`, { signal: controller.signal });
        const data = await res.json();
        setEntries(data.entries ?? []);
        setStories(data.stories ?? []);
        setLoadedAt(new Date());
      } catch (err) {
        if ((err as Error).name !== "AbortError") setEntries([]);
      }
    });
    return () => controller.abort();
  }, [dictionary.id, refreshToken, reloadKey]);

  const start = loadedAt ? rangeStart(range, loadedAt) : null;
  const summary = summarize(entries, start);
  const entriesInRange = start ? entries.filter((e) => new Date(e.occurredAt) >= start) : entries;

  async function run(path: string, body: Record<string, unknown>) {
    setError(null);
    try {
      await post(path, body);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setRefreshToken((t) => t + 1);
    }
  }

  async function addEntry() {
    if (!amount.trim()) return;
    const ok = await run("/api/worthy", { dictionaryId: dictionary.id, type: "entry", kind, amount, note: entryNote });
    if (ok) {
      setAmount("");
      setEntryNote("");
    }
  }

  async function addStory() {
    if (!storyBody.trim()) return;
    const ok = await run("/api/worthy", {
      dictionaryId: dictionary.id,
      type: "story",
      occurredOn: storyDate,
      outcome: storyOutcome,
      body: storyBody,
      principles: storyPrinciples,
    });
    if (ok) {
      setStoryBody("");
      setStoryPrinciples([]);
    }
  }

  function togglePrinciple(p: Principle) {
    setStoryPrinciples((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: "Deposited", value: money(summary.deposits) },
    { label: "Wins", value: money(summary.wins) },
    {
      label: "Savings",
      value: `${money(summary.savings)} of ${money(summary.savingsOwed)}`,
      hint:
        summary.savingsGap > 0
          ? `Save ${money(summary.savingsGap)} more to meet the rule.`
          : "Rule met. Every win is locked in.",
    },
    { label: "Savings / deposited", value: pct(summary.savingsPctOfDeposits) },
    {
      label: "Balance",
      value: money(summary.balance),
      hint: summary.hasBalance ? undefined : "Log a Balance to track it.",
    },
    { label: "Balance / deposited", value: pct(summary.balancePctOfDeposits) },
    { label: "Loss", value: money(summary.loss), hint: "Deposits − balance − savings" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>

      <div className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
        <p className="font-medium">Save half of every win.</p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          {PRINCIPLES.map((p) => (
            <li key={p}>{PRINCIPLE_LABELS[p]}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs font-medium">
          Ask: Does my bet make sense for my scheme? Is there a reason to pick one bet over the other?
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              range === r ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
            }`}
          >
            {TIME_FRAME_LABELS[r]}
          </button>
        ))}
      </div>

      {isLoading && !loadedAt ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col rounded-md border border-neutral-200 px-3 py-2">
              <span className="text-xs text-neutral-500">{tile.label}</span>
              <span className="text-sm font-medium">{tile.value}</span>
              {tile.hint && <span className="text-xs text-neutral-400">{tile.hint}</span>}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
        <p className="text-sm font-medium">Log an entry</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as WorthyKind)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            {WORTHY_KINDS.map((k) => (
              <option key={k} value={k}>
                {WORTHY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={entryNote}
            onChange={(e) => setEntryNote(e.target.value)}
            placeholder="Note (optional)"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={!amount.trim()}
            onClick={addEntry}
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {entriesInRange.length > 0 && (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {entriesInRange.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-36 shrink-0 text-xs text-neutral-400">
                  {new Date(entry.occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className="w-16 shrink-0">{WORTHY_KIND_LABELS[entry.kind]}</span>
                <span className="w-24 shrink-0 font-medium">{money(entry.amount)}</span>
                <span className="min-w-0 flex-1 text-neutral-700">{entry.note}</span>
                <button
                  type="button"
                  onClick={() => window.confirm("Delete this entry for good?") && run("/api/worthy/delete", { entryId: entry.id })}
                  className="text-neutral-400 hover:text-red-600"
                  aria-label="Delete entry"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
        <p className="text-sm font-medium">Bet Stories</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={storyDate}
            onChange={(e) => setStoryDate(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <select
            value={storyOutcome}
            onChange={(e) => setStoryOutcome(e.target.value as BetOutcome)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            {BET_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {BET_OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={storyBody}
          onChange={(e) => setStoryBody(e.target.value)}
          placeholder="What happened, and what you felt..."
          rows={3}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        <div className="flex flex-wrap items-center gap-1">
          {PRINCIPLES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePrinciple(p)}
              className={`rounded-full px-2 py-0.5 text-xs ${
                storyPrinciples.includes(p) ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
              }`}
            >
              {PRINCIPLE_SHORT[p]}
            </button>
          ))}
          <button
            type="button"
            disabled={!storyBody.trim()}
            onClick={addStory}
            className="ml-auto rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            Save story
          </button>
        </div>

        {stories.length === 0 ? (
          <p className="text-sm text-neutral-400">No bet stories yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {stories.map((story) => (
              <li key={story.id} className="flex flex-col gap-1 py-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span>{story.occurredOn}</span>
                  <span className="font-medium text-neutral-700">{BET_OUTCOME_LABELS[story.outcome]}</span>
                  {story.principles.map((p) => (
                    <span key={p} className="rounded-full bg-neutral-100 px-2 py-0.5">
                      {PRINCIPLE_SHORT[p]}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      window.confirm("Delete this story for good?") && run("/api/worthy/delete", { storyId: story.id })
                    }
                    className="ml-auto text-neutral-400 hover:text-red-600"
                    aria-label="Delete story"
                  >
                    ✕
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-neutral-700">{story.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
