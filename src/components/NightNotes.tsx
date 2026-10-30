"use client";

import { useEffect, useState, useTransition } from "react";
import type { NightView } from "@/lib/preferences";
import { DeleteButton, UndoBar, formatDate, useUndoDelete } from "./ui";
import {
  isNoteSort,
  isTimeFrame,
  NOTE_LABELS,
  NOTE_SORT_LABELS,
  NOTE_SORTS,
  TIME_FRAMES,
  TIME_FRAME_LABELS,
  type NoteSort,
  type TimeFrame,
} from "@/lib/time-frames";

type NotesDictionary = { id: string; name: string };
type NoteState = "active" | "archived" | "done";

type NoteRow = {
  id: string;
  body: string;
  dictionaryId: string;
  dictionaryName: string;
  visibility: "public" | "private";
  timeFrame: TimeFrame;
  label: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  doneAt: string | null;
};

const STATE_TABS: { key: NoteState; label: string }[] = [
  { key: "active", label: "Notes" },
  { key: "archived", label: "Archived" },
  { key: "done", label: "Done" },
];

function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
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


const formatWhen = (iso: string | null) => formatDate(iso, true);

// Night DS Display View. Every note lives for its time frame, then
// archives itself, so you keep letting go and starting fresh.
// The list, filters, and sort come back as you left them (saved with the
// rest of your arrangement).
export function NightNotes({
  dictionaries,
  reloadKey = 0,
  view = {},
  onViewChange,
}: {
  dictionaries: NotesDictionary[];
  reloadKey?: number;
  view?: NightView;
  onViewChange?: (view: NightView) => void;
}) {
  const state: NoteState = view.state ?? "active";
  const timeFrameFilter = (view.timeFrames ?? []).filter(isTimeFrame);
  const labelFilter = view.labels ?? [];
  const sort: NoteSort = isNoteSort(view.sort) ? view.sort : "shortest";
  const change = (next: NightView) => onViewChange?.({ ...view, ...next });
  const setState = (next: NoteState) => change({ state: next });
  const setTimeFrameFilter = (next: TimeFrame[]) => change({ timeFrames: next });
  const setLabelFilter = (next: string[]) => change({ labels: next });
  const setSort = (next: NoteSort) => change({ sort: next });
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const [newBody, setNewBody] = useState("");
  const [newTimeFrame, setNewTimeFrame] = useState<TimeFrame>("day");
  const [newLabel, setNewLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [dragging, setDragging] = useState<NoteRow | null>(null);

  const deleting = useUndoDelete<NoteRow>((note) => {
    post("/api/notes/delete", { noteId: note.id })
      .catch(() => {})
      .finally(() => setRefreshToken((t) => t + 1));
  });

  const idsKey = dictionaries.map((d) => d.id).join(",");
  const primaryId = dictionaries[0]?.id ?? null;

  // Back to page 1 whenever the list or a filter changes. Computed during
  // render so there's no extra commit.
  const timeFramesKey = timeFrameFilter.join(",");
  const labelsKey = labelFilter.join(",");
  const filterKey = `${idsKey}|${state}|${timeFramesKey}|${labelsKey}|${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    if (!idsKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryIds: idsKey, state, sort, page: String(page) });
    if (timeFramesKey) params.set("timeFrames", timeFramesKey);
    if (labelsKey) params.set("labels", labelsKey);

    startLoading(async () => {
      try {
        const res = await fetch(`/api/notes?${params}`, { signal: controller.signal });
        const data = await res.json();
        setNotes(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setNotes([]);
      }
    });

    return () => controller.abort();
  }, [idsKey, state, timeFramesKey, labelsKey, sort, page, refreshToken, reloadKey]);

  async function run(path: string, body: Record<string, unknown>) {
    setError(null);
    try {
      await post(path, body);
    } catch (err) {
      setError((err as Error).message);
    }
    setRefreshToken((t) => t + 1);
  }

  async function addNote() {
    const body = newBody.trim();
    if (!primaryId || !body) return;
    setIsAdding(true);
    await run("/api/notes", {
      dictionaryId: primaryId,
      body,
      timeFrame: newTimeFrame,
      label: newLabel,
      timeZone: timeZone(),
    });
    setNewBody("");
    setIsAdding(false);
  }

  async function archiveAll() {
    if (!primaryId || notes.length === 0) return;
    if (!window.confirm(`Archive the ${notes.length} note(s) shown and start fresh?`)) return;
    await run("/api/notes/archive", { dictionaryId: primaryId, noteIds: notes.map((n) => n.id) });
  }

  const shownNotes = deleting.hide(notes);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setState(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              state === tab.key ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <label className="ml-2 text-xs text-neutral-500">Sort</label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as NoteSort)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          {NOTE_SORTS.map((s) => (
            <option key={s} value={s}>
              {NOTE_SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Filters: pick any number. Nothing picked shows everything. */}
      <div className="flex flex-col gap-1.5">
        <FilterChips
          title="Time frame"
          options={TIME_FRAMES.map((tf) => ({ value: tf, label: TIME_FRAME_LABELS[tf] }))}
          picked={timeFrameFilter}
          onChange={(next) => setTimeFrameFilter(next as TimeFrame[])}
        />
        <FilterChips
          title="Label"
          options={NOTE_LABELS.map((l) => ({ value: l, label: l }))}
          picked={labelFilter}
          onChange={setLabelFilter}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {deleting.pending && <UndoBar text={deleting.pending.body.split("\n")[0]} onUndo={deleting.undo} />}

      {state === "active" && primaryId && (
        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Write a new note..."
            rows={2}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <TimeFrameSelect value={newTimeFrame} onChange={setNewTimeFrame} />
            <LabelSelect value={newLabel} onChange={setNewLabel} />
            <button
              type="button"
              disabled={isAdding || !newBody.trim()}
              onClick={addNote}
              className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Add note
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : shownNotes.length === 0 ? (
        <p className="text-sm text-neutral-400">
          {state === "active" ? "No notes here. Write one above." : state === "done" ? "Nothing done here yet." : "Nothing archived here."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {shownNotes.map((note, index) => (
            <NoteItem
              key={`${note.id}-${refreshToken}-${reloadKey}`}
              note={note}
              state={state}
              isFirst={index === 0}
              isLast={index === shownNotes.length - 1}
              canReorder={sort === "mine"}
              onRun={run}
              onDelete={() => deleting.remove(note)}
              dragging={dragging}
              onDragChange={setDragging}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
          Prev
        </button>
        <span className="text-neutral-500">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="disabled:opacity-40"
        >
          Next
        </button>
        {state === "active" && notes.length > 0 && (
          <button type="button" onClick={archiveAll} className="ml-auto text-xs underline">
            Archive all shown
          </button>
        )}
      </div>
    </div>
  );
}

function NoteItem({
  note,
  state,
  isFirst,
  isLast,
  onRun,
  onDelete,
  dragging,
  onDragChange,
  canReorder,
}: {
  note: NoteRow;
  state: NoteState;
  isFirst: boolean;
  isLast: boolean;
  onRun: (path: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
  dragging: NoteRow | null;
  onDragChange: (note: NoteRow | null) => void;
  canReorder: boolean;
}) {
  const [restoreTimeFrame, setRestoreTimeFrame] = useState<TimeFrame>(note.timeFrame);
  const [label, setLabel] = useState(note.label ?? "");
  const isActive = state === "active";

  const meta = isActive
    ? note.expiresAt
      ? `Archives ${formatWhen(note.expiresAt)}`
      : "Lives for life"
    : state === "done"
      ? `Done ${formatWhen(note.doneAt)}`
      : `Archived ${formatWhen(note.archivedAt)}`;

  // Drag by the ⠿ handle onto another note in the same dictionary to take
  // its place. Mouse only; phones use the arrows. A note dragged over a
  // text box never drops its text in.
  const canDrop = isActive && dragging !== null && dragging.id !== note.id && dragging.dictionaryId === note.dictionaryId;

  return (
    <li
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = canDrop ? "move" : "none";
      }}
      onDrop={(e) => {
        if (!dragging) return;
        e.preventDefault();
        if (canDrop) onRun("/api/notes/reorder", { noteId: dragging.id, targetId: note.id });
        onDragChange(null);
      }}
      className={`flex flex-col gap-2 py-3 ${dragging?.id === note.id ? "opacity-40" : ""} ${canDrop ? "hover:bg-blue-50" : ""}`}
    >
      <textarea
        defaultValue={note.body}
        rows={Math.min(6, Math.max(1, Math.ceil(note.body.length / 80)))}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next && next !== note.body) onRun("/api/notes/update", { noteId: note.id, body: next });
        }}
        aria-label="Note"
        className="resize-y rounded-md border border-transparent px-2 py-1 text-sm hover:border-neutral-200 focus:border-neutral-300"
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Moving notes only makes sense in My order. */}
        {isActive && canReorder && (
          <div className="flex items-center">
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", "");
                onDragChange(note);
              }}
              onDragEnd={() => onDragChange(null)}
              title="Drag to move"
              aria-hidden="true"
              className="hidden cursor-grab select-none px-1 text-neutral-400 hover:text-neutral-900 sm:inline"
            >
              ⠿
            </span>
            <button
              type="button"
              disabled={isFirst}
              onClick={() => onRun("/api/notes/reorder", { noteId: note.id, direction: "up" })}
              className="px-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
              aria-label="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={() => onRun("/api/notes/reorder", { noteId: note.id, direction: "down" })}
              className="px-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
        )}
        {isActive ? (
          <TimeFrameSelect
            value={note.timeFrame}
            onChange={(tf) => onRun("/api/notes/update", { noteId: note.id, timeFrame: tf, timeZone: timeZone() })}
          />
        ) : (
          <>
            <span className="text-neutral-500">{TIME_FRAME_LABELS[note.timeFrame]}</span>
            <span className="text-neutral-400">Restore as</span>
            <TimeFrameSelect value={restoreTimeFrame} onChange={setRestoreTimeFrame} />
            <button
              type="button"
              onClick={() =>
                onRun("/api/notes/restore", { noteId: note.id, timeFrame: restoreTimeFrame, timeZone: timeZone() })
              }
              className="rounded-full border border-neutral-300 px-2 py-0.5 font-medium"
            >
              Restore
            </button>
          </>
        )}

        <LabelSelect
          value={label}
          onChange={(next) => {
            setLabel(next);
            onRun("/api/notes/update", { noteId: note.id, label: next });
          }}
        />

        <span className="text-neutral-400">{meta}</span>

        <div className="ml-auto flex items-center gap-3">
          {isActive && (
            <>
              <button
                type="button"
                onClick={() =>
                  onRun("/api/notes/visibility", {
                    noteId: note.id,
                    visibility: note.visibility === "public" ? "private" : "public",
                  })
                }
                className={`rounded-full px-2 py-0.5 font-medium ${
                  note.visibility === "public" ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
                }`}
              >
                {note.visibility === "public" ? "Public" : "Private"}
              </button>
              <button
                type="button"
                onClick={() => onRun("/api/notes/done", { noteId: note.id })}
                className="rounded-full border border-neutral-300 px-2 py-0.5 font-medium hover:border-neutral-900"
              >
                Mark done
              </button>
              <button
                type="button"
                onClick={() => onRun("/api/notes/archive", { noteId: note.id })}
                className="rounded-full border border-neutral-300 px-2 py-0.5 font-medium"
              >
                Archive
              </button>
            </>
          )}
          <DeleteButton onClick={onDelete} what="note" />
        </div>
      </div>
    </li>
  );
}

function FilterChips({
  title,
  options,
  picked,
  onChange,
}: {
  title: string;
  options: { value: string; label: string }[];
  picked: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 text-xs text-neutral-500">{title}</span>
      {options.map((o) => {
        const on = picked.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? picked.filter((v) => v !== o.value) : [...picked, o.value])}
            className={`rounded-full px-2.5 py-0.5 text-xs ${on ? "bg-blue-600 text-white" : "border border-neutral-300 text-neutral-600"}`}
          >
            {o.label}
          </button>
        );
      })}
      {picked.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="text-xs text-neutral-500 underline">
          Clear
        </button>
      )}
    </div>
  );
}

function TimeFrameSelect({ value, onChange }: { value: TimeFrame; onChange: (tf: TimeFrame) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TimeFrame)}
      aria-label="Time frame"
      className="rounded-md border border-neutral-300 px-2 py-0.5 text-xs"
    >
      {TIME_FRAMES.map((tf) => (
        <option key={tf} value={tf}>
          {TIME_FRAME_LABELS[tf]}
        </option>
      ))}
    </select>
  );
}

// One label per note: goal, lesson, memory, idea, person, place, or none.
function LabelSelect({ value, onChange }: { value: string; onChange: (label: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Label"
      className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs"
    >
      <option value="">no label</option>
      {NOTE_LABELS.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
    </select>
  );
}
