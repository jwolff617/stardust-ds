"use client";

import { useEffect, useState } from "react";
import { addLabel, getLabels, removeLabel, setShows } from "@/app/actions/dictionaries";
import type { DictionaryLabelInfo } from "@/lib/dictionary-labels";
import { setShape } from "@/app/actions/listings";
import { LASTS_OPTIONS, shapeText } from "@/lib/listings";
import { LabeledDictionaries } from "./LabeledDictionaries";
import { input, link, primary, tag } from "./ui";

const EMPTY: DictionaryLabelInfo = { labels: [], shows: [], canEdit: false, canEditShows: false, noun: null, fields: [], photoLimit: 0, lastsDays: null };

// Above every dictionary in the feed: its labels, the labels it shows, and
// the dictionaries carrying those. Label a dictionary #idea and it shows up
// in anything that shows #idea. No code per label or per dictionary.
export function DictionaryLabels({
  dictionaryId,
  reloadKey = 0,
  onChange,
}: {
  dictionaryId: string;
  reloadKey?: number;
  onChange?: () => void;
}) {
  const [info, setInfo] = useState<DictionaryLabelInfo>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getLabels(dictionaryId)
      .then((r) => live && setInfo(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [dictionaryId, reloadKey]);

  async function addLabels(text: string) {
    setError(null);
    for (const l of split(text)) {
      try {
        const saved = await addLabel(dictionaryId, l);
        setInfo((i) => ({ ...i, labels: [...new Set([...i.labels, saved])].sort() }));
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  async function dropLabel(label: string) {
    setError(null);
    setInfo((i) => ({ ...i, labels: i.labels.filter((l) => l !== label) }));
    try {
      await removeLabel(dictionaryId, label);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function changeShows(next: string[]) {
    setError(null);
    const shows = [...new Set(next)];
    setInfo((i) => ({ ...i, shows }));
    try {
      await setShows(dictionaryId, shows);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveShape(m: MakerSettings) {
    setError(null);
    try {
      await setShape(dictionaryId, m.noun, m.shape, m.photoLimit, m.lastsDays);
      setInfo(await getLabels(dictionaryId));
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }

  const showLabels = info.canEdit || info.labels.length > 0;
  const showShows = info.canEditShows || info.shows.length > 0;
  if (!showLabels && !showShows) return null;

  return (
    <div className="mb-3 flex flex-col gap-2">
      {showLabels && (
        <ChipRow
          title="Labels"
          chips={info.labels}
          editable={info.canEdit}
          placeholder="+ label"
          onAdd={addLabels}
          onRemove={dropLabel}
        />
      )}
      {showShows && (
        <ChipRow
          title="Imports"
          chips={info.shows}
          editable={info.canEditShows}
          placeholder="+ import a label"
          onAdd={(text) => changeShows([...info.shows, ...split(text).map(clean)])}
          onRemove={(l) => changeShows(info.shows.filter((x) => x !== l))}
        />
      )}
      {info.noun && info.canEditShows && <MakesRow
          settings={{ noun: info.noun, shape: shapeText(info.fields), photoLimit: info.photoLimit, lastsDays: info.lastsDays }}
          onSave={saveShape}
        />}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {info.shows.length > 0 && (
        <div className="mt-1">
          <LabeledDictionaries
            labels={info.shows}
            exceptId={dictionaryId}
            maker={info.noun ? { searchId: dictionaryId, noun: info.noun, fields: info.fields, photoLimit: info.photoLimit, lastsDays: info.lastsDays } : undefined}
            reloadKey={reloadKey}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

const split = (text: string) => text.split(",").map((l) => l.trim()).filter(Boolean);
const clean = (l: string) => l.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, " ");

function ChipRow({
  title,
  chips,
  editable,
  placeholder,
  onAdd,
  onRemove,
}: {
  title: string;
  chips: string[];
  editable: boolean;
  placeholder: string;
  onAdd: (text: string) => void;
  onRemove: (chip: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    if (draft.trim()) onAdd(draft);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 text-xs text-neutral-500">{title}</span>
      {chips.map((l) => (
        <span key={l} className={tag}>
          {l}
          {editable && (
            <button type="button" onClick={() => onRemove(l)} aria-label={`Remove ${l}`} className="ml-1 text-neutral-400 hover:text-red-600">
              ✕
            </button>
          )}
        </span>
      ))}
      {editable && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          onBlur={commit}
          placeholder={placeholder}
          aria-label={`${title}: add`}
          maxLength={80}
          className="w-32 rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs"
        />
      )}
    </div>
  );
}

export type MakerSettings = { noun: string; shape: string; photoLimit: number; lastsDays: number | null };

const lastsLabel = (days: number | null) => LASTS_OPTIONS.find((o) => o.days === days)?.label ?? `${days} days`;

// For the owner: what "+ New" makes, what it asks for, photos, and how
// long each one runs.
function MakesRow({ settings, onSave }: { settings: MakerSettings; onSave: (m: MakerSettings) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [m, setM] = useState(settings);
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="w-14 text-neutral-500">Makes</span>
        <span className="text-neutral-700">
          {settings.noun}: {settings.shape}
          <span className="text-neutral-400">
            {" "}
            · {settings.photoLimit ? `${settings.photoLimit} photo${settings.photoLimit === 1 ? "" : "s"}` : "no photos"} · runs{" "}
            {lastsLabel(settings.lastsDays).toLowerCase()}
          </span>
        </span>
        <button type="button" onClick={() => (setM(settings), setEditing(true))} className={link}>
          Change
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(m)) setEditing(false);
      }}
      className="flex flex-col gap-2 rounded-md border border-neutral-200 p-2 text-xs text-neutral-600"
    >
      <MakerFields value={m} onChange={setM} />
      <p className="text-neutral-400">Ones already shared keep their old fields.</p>
      <div className="flex items-center gap-3">
        <button type="submit" className={primary}>
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className={link}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// What a search makes: shared by the Makes row and + Create.
export function MakerFields({ value, onChange }: { value: MakerSettings; onChange: (m: MakerSettings) => void }) {
  const set = (change: Partial<MakerSettings>) => onChange({ ...value, ...change });
  return (
    <>
      <label className="flex flex-col gap-1">
        Its &quot;+ New&quot; button makes a (one word)
        <input value={value.noun} onChange={(e) => set({ noun: e.target.value })} placeholder="listing" maxLength={30} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        Each one asks for, with commas. Add (long), (number), or (date) after a field. Up to 8.
        <input value={value.shape} onChange={(e) => set({ shape: e.target.value })} className={input} />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5">
          Photos
          <select value={value.photoLimit} onChange={(e) => set({ photoLimit: Number(e.target.value) })} className={input}>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "None" : `Up to ${n}`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Each one runs
          <select value={value.lastsDays ?? ""} onChange={(e) => set({ lastsDays: e.target.value ? Number(e.target.value) : null })} className={input}>
            {LASTS_OPTIONS.map((o) => (
              <option key={o.label} value={o.days ?? ""}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
