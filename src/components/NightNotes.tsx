"use client";

import { useEffect, useState, useTransition } from "react";
import { NOTE_LABELS, TIME_FRAMES, TIME_FRAME_LABELS, type TimeFrame } from "@/lib/time-frames";

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

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Night DS Display View. Every note lives for its time frame, then
// archives itself, so you keep letting go and starting fresh.
export function NightNotes({ dictionaries, reloadKey = 0 }: { dictionaries: NotesDictionary[]; reloadKey?: number }) {
  const [state, setState] = useState<NoteState>("active");
  const [timeFrameFilter, setTimeFrameFilter] = useState<TimeFrame | "">("");
  const [labelFilter, setLabelFilter] = useState("");
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

  const idsKey = dictionaries.map((d) => d.id).join(",");
  const primaryId = dictionaries[0]?.id ?? null;

  // Back to page 1 whenever the list or a filter changes. Computed during
  // render so there's no extra commit.
  const filterKey = `${idsKey}|${state}|${timeFrameFilter}|${labelFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    if (!idsKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryIds: idsKey, state, page: String(page) });
    if (timeFrameFilter) params.set("timeFrame", timeFrameFilter);
    if (labelFilter) params.set("label", labelFilter);

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
  }, [idsKey, state, timeFrameFilter, labelFilter, page, refreshToken, reloadKey]);

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

  async function deleteNote(noteId: string) {
    if (!window.confirm("Delete this note for good?")) return;
    await run("/api/notes/delete", { noteId });
  }

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
        <label className="ml-2 text-xs text-neutral-500">Time frame</label>
        <select
          value={timeFrameFilter}
          onChange={(e) => setTimeFrameFilter(e.target.value as TimeFrame | "")}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">None</option>
          {TIME_FRAMES.map((tf) => (
            <option key={tf} value={tf}>
              {TIME_FRAME_LABELS[tf]}
            </option>
          ))}
        </select>
        <label className="text-xs text-neutral-500">Label</label>
        <select
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">None</option>
          {NOTE_LABELS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
      ) : notes.length === 0 ? (
        <p className="text-sm text-neutral-400">
          {state === "active" ? "No notes here. Write one above." : state === "done" ? "Nothing done here yet." : "Nothing archived here."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {notes.map((note, index) => (
            <NoteItem
              key={`${note.id}-${refreshToken}-${reloadKey}`}
              note={note}
              state={state}
              isFirst={index === 0}
              isLast={index === notes.length - 1}
              onRun={run}
              onDelete={() => deleteNote(note.id)}
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
}: {
  note: NoteRow;
  state: NoteState;
  isFirst: boolean;
  isLast: boolean;
  onRun: (path: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
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

  return (
    <li className="flex flex-col gap-2 py-3">
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
        {isActive && (
          <div className="flex items-center">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => onRun("/api/notes/reorder", { noteId: note.id, direction: "up" })}
              className="px-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={() => onRun("/api/notes/reorder", { noteId: note.id, direction: "down" })}
              className="px-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
              aria-label="Move down"
            >
              ↓
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

        <div className="ml-auto flex items-center gap-2">
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
                className="rounded-full bg-neutral-900 px-2 py-0.5 font-medium text-white"
              >
                Done
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
          <button
            type="button"
            onClick={onDelete}
            className="text-neutral-400 hover:text-red-600"
            aria-label="Delete note"
          >
            ✕
          </button>
        </div>
      </div>
    </li>
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
