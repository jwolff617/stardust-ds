"use client";

import { useEffect, useState } from "react";
import { confirmAdult, deleteEntry, isAdult, myEntries, pauseEntry, saveEntry, type EntryInput } from "@/app/actions/profile";
import { detailsLine, ENTRY_KINDS, KIND_LABELS, SIDE_LABELS, type EntryKind, type ProfileEntry } from "@/lib/profile-entries";
import { input, link, primary, quiet } from "./ui";

const BLANK = (kind: EntryKind): EntryInput => ({
  kind,
  side: "offer",
  word: "",
  body: "",
  place: "",
  people: "",
  visibility: "public",
  details: kind === "person" ? { relationship: "friendship" } : {},
});

// Your Profile: who you are and who you hope to meet, your ideas, jobs, and
// resources. Each one offered or sought. Sage matches them by shared words.
export function ProfileView({ reloadKey = 0, section }: { reloadKey?: number; section?: string }) {
  // Four profiles in one: person (pp), idea (pi), job (pj), resource (pr).
  const [only, setOnly] = useState<EntryKind | null>((ENTRY_KINDS as readonly string[]).includes(section ?? "") ? (section as EntryKind) : null);
  const [entries, setEntries] = useState<ProfileEntry[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; input: EntryInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    myEntries()
      .then(setEntries)
      .catch((err) => setError((err as Error).message));
  }, [token, reloadKey]);

  const refresh = () => setToken((t) => t + 1);

  async function act(work: () => Promise<void>) {
    setError(null);
    try {
      await work();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!entries) return <p className="text-sm text-neutral-400">{error ?? "Loading your profile..."}</p>;

  return (
    <div className="flex flex-col gap-6 text-neutral-900">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[null, ...ENTRY_KINDS].map((k) => (
          <button
            key={k ?? "all"}
            type="button"
            onClick={() => setOnly(k)}
            aria-pressed={only === k}
            className={`rounded-full border px-3 py-1 ${only === k ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"}`}
          >
            {k ? `${KIND_LABELS[k]} profile` : "All"}
          </button>
        ))}
      </div>
      <p className="text-sm text-neutral-600">
        What you offer and what you seek. Always public: this is how sparks find and match you. Pause one to hide it.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {ENTRY_KINDS.filter((k) => !only || k === only).map((kind) => {
        const mine = entries.filter((e) => e.kind === kind);
        return (
          <section key={kind} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm font-semibold tracking-[0.2em]">{KIND_LABELS[kind].toUpperCase()}</h3>
              <button type="button" onClick={() => setEditing({ id: null, input: BLANK(kind) })} className={link}>
                + Add
              </button>
            </div>
            {mine.length === 0 && <p className="text-xs text-neutral-400">Nothing yet.</p>}
            <ul className="flex flex-col gap-2">
              {mine.map((e) => (
                <li key={e.id} className="rounded-md p-3 ring-1 ring-neutral-200">
                  <div className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="font-medium">{e.word}</span>
                    <span className="text-xs text-neutral-500">{SIDE_LABELS[e.kind][e.side]}</span>
                    {detailsLine(e) && <span className="text-xs text-neutral-500">· {detailsLine(e)}</span>}
                    {e.visibility === "private" && <span className="text-xs text-neutral-500">· private (from before)</span>}
                    {e.paused && <span className="text-xs text-amber-700">· paused</span>}
                    {e.hidden && <span className="text-xs text-red-700">· hidden after reports</span>}
                  </div>
                  {e.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-neutral-700">{e.body}</p>}
                  {(e.place || e.people) && <p className="mt-1 text-xs text-neutral-500">{[e.place, e.people].filter(Boolean).join(" · ")}</p>}
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      className={link}
                      onClick={() =>
                        setEditing({
                          id: e.id,
                          input: { kind: e.kind, side: e.side, word: e.word, body: e.body, place: e.place, people: e.people, visibility: e.visibility, details: e.details },
                        })
                      }
                    >
                      Edit
                    </button>
                    <button type="button" className={link} onClick={() => act(() => pauseEntry(e.id, !e.paused))}>
                      {e.paused ? "Unpause" : "Pause"}
                    </button>
                    <button
                      type="button"
                      className={link}
                      onClick={() => window.confirm(`Delete "${e.word}"?`) && act(() => deleteEntry(e.id))}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {editing && editing.input.kind === kind && (
              <EntryForm
                start={editing.input}
                isNew={!editing.id}
                onCancel={() => setEditing(null)}
                onSave={async (inp) => {
                  await saveEntry(editing.id, inp);
                  setEditing(null);
                  refresh();
                }}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function EntryForm({ start, isNew, onSave, onCancel }: { start: EntryInput; isNew: boolean; onSave: (i: EntryInput) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const [adult, setAdult] = useState<boolean | null>(null);
  const [birth, setBirth] = useState("");
  const romance = f.kind === "person" && f.details.relationship === "romance";

  useEffect(() => {
    if (romance && adult === null) isAdult().then(setAdult).catch(() => setAdult(false));
  }, [romance, adult]);

  const set = (k: keyof EntryInput) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setD = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, details: { ...x.details, [k]: e.target.value } }));
  const sides = SIDE_LABELS[f.kind];

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await onSave(f);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
      className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3 text-sm"
    >
      <div className="flex flex-wrap gap-2">
        <select value={f.side} onChange={set("side")} aria-label="Offer or seek" className={input}>
          <option value="offer">{sides.offer}</option>
          <option value="seek">{sides.seek}</option>
        </select>
        {f.kind === "person" && (
          <select value={f.details.relationship ?? "friendship"} onChange={setD("relationship")} aria-label="Relationship" className={input}>
            <option value="friendship">Friendship</option>
            <option value="business">Business</option>
            <option value="romance">Romance (18+)</option>
          </select>
        )}
      </div>
      <input autoFocus value={f.word} onChange={set("word")} maxLength={120} placeholder="Word: a short title" aria-label="Word" className={input} />
      <textarea value={f.body} onChange={set("body")} maxLength={5000} rows={4} placeholder="Say it in your own words." aria-label="Body" className={`${input} resize-y`} />
      <div className="flex flex-wrap gap-2">
        <input value={f.place} onChange={set("place")} maxLength={120} placeholder="Place" aria-label="Place" className={`${input} min-w-0 flex-1`} />
        <input value={f.people} onChange={set("people")} maxLength={300} placeholder="People" aria-label="People" className={`${input} min-w-0 flex-1`} />
      </div>

      {f.kind === "job" && <input value={f.details.pay ?? ""} onChange={setD("pay")} maxLength={60} placeholder="Pay: $25/hr, volunteer..." aria-label="Pay" className={input} />}
      {f.kind === "resource" && (
        <div className="flex flex-wrap gap-2">
          <select value={f.details.deal ?? ""} onChange={setD("deal")} aria-label="Free or for sale" className={input}>
            <option value="">Free, sale, or trade?</option>
            <option value="free">Free</option>
            <option value="sale">For sale</option>
            <option value="trade">Trade</option>
          </select>
          {f.details.deal === "sale" && <input value={f.details.price ?? ""} onChange={setD("price")} maxLength={60} placeholder="Price" aria-label="Price" className={input} />}
        </div>
      )}

      {romance && adult === false && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-amber-50 p-2 text-xs">
          <span>Romance is 18 and older. Your birth date is checked and not kept.</span>
          <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} aria-label="Birth date" className={input} />
          <button
            type="button"
            className={quiet}
            onClick={async () => {
              setError(null);
              try {
                await confirmAdult(birth);
                setAdult(true);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Confirm
          </button>
        </div>
      )}
      {romance && adult && (
        <div className="flex flex-wrap gap-2 text-xs">
          <input type="number" min={18} max={120} value={f.details.age ?? ""} onChange={setD("age")} placeholder="Your age" aria-label="Your age" className={`${input} w-24`} />
          <select value={f.details.iam ?? ""} onChange={setD("iam")} aria-label="I am" className={input}>
            <option value="">I am...</option>
            <option value="woman">A woman</option>
            <option value="man">A man</option>
            <option value="nonbinary">Nonbinary</option>
          </select>
          <select value={f.details.meet ?? ""} onChange={setD("meet")} aria-label="Hoping to meet" className={input}>
            <option value="">Hoping to meet...</option>
            <option value="women">Women</option>
            <option value="men">Men</option>
            <option value="everyone">Everyone</option>
          </select>
          <span className="self-center">ages</span>
          <input type="number" min={18} max={120} value={f.details.age_min ?? ""} onChange={setD("age_min")} placeholder="from" aria-label="Ages from" className={`${input} w-20`} />
          <input type="number" min={18} max={120} value={f.details.age_max ?? ""} onChange={setD("age_max")} placeholder="to" aria-label="Ages to" className={`${input} w-20`} />
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={!f.word.trim() || (romance && !adult)} className={primary}>
          {isNew ? "Add" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={link}>
          Cancel
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}
