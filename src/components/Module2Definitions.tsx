"use client";

import { useEffect, useState, useTransition } from "react";

type SelectedDictionary = { id: string; name: string; displayKind: string };
type PartOfSpeech = "verb" | "noun" | "more";
type DefinitionRow = {
  id: string;
  term: string;
  body: string;
  partOfSpeech: PartOfSpeech;
  dictionaryId: string;
  dictionaryName: string;
};
type NoteRow = {
  id: string;
  body: string;
  dictionaryId: string;
  dictionaryName: string;
  visibility: "public" | "private";
};
type ArchiveRow = {
  id: string;
  label: string | null;
  createdAt: string;
  noteCount: number;
};

const TABS: { key: PartOfSpeech; label: string }[] = [
  { key: "verb", label: "Verbs" },
  { key: "noun", label: "Nouns" },
  { key: "more", label: "More" },
];

const NOTE_PAGE_SIZES = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 200];

export function Module2Definitions({ dictionaries }: { dictionaries: SelectedDictionary[] }) {
  // Everything opted-in (Module 1) is active by default; this only tracks
  // what the user has explicitly unchecked in the left-hand filter menu, so
  // newly opted-in dictionaries show up active with no effect needed to
  // sync state from the `dictionaries` prop.
  const [deselectedIds, setDeselectedIds] = useState<string[]>([]);
  const [activeTabs, setActiveTabs] = useState<PartOfSpeech[]>(["verb", "noun", "more"]);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DefinitionRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, startLoading] = useTransition();

  const [notePage, setNotePage] = useState(1);
  const [notePageSize, setNotePageSize] = useState(5);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [noteTotalPages, setNoteTotalPages] = useState(1);
  const [isLoadingNotes, startLoadingNotes] = useTransition();
  const [refreshToken, setRefreshToken] = useState(0);

  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveCandidates, setArchiveCandidates] = useState<NoteRow[]>([]);
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  const [archiveLabel, setArchiveLabel] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);

  const [showArchives, setShowArchives] = useState(false);
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [archiveNotes, setArchiveNotes] = useState<NoteRow[]>([]);

  const [newNoteBody, setNewNoteBody] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  const activeDictionaryIds = dictionaries
    .map((d) => d.id)
    .filter((id) => !deselectedIds.includes(id));

  // Dictionaries with their own real content display (e.g. a Night DS
  // instance's notes) rather than just a word/definition vocabulary table.
  const displayCapable = dictionaries.filter(
    (d) => d.displayKind === "notes_list" && !deselectedIds.includes(d.id),
  );
  const hasDisplayCapable = displayCapable.length > 0;

  const [viewMode, setViewMode] = useState<"term" | "display">(
    dictionaries.some((d) => d.displayKind === "notes_list") ? "display" : "term",
  );

  // Default to Display View the moment a notes-capable dictionary becomes
  // selectable, and back to Term View when none remain. Computed during
  // render rather than in an effect, so there's no extra commit/flash.
  const [prevHasDisplayCapable, setPrevHasDisplayCapable] = useState(hasDisplayCapable);
  if (hasDisplayCapable !== prevHasDisplayCapable) {
    setPrevHasDisplayCapable(hasDisplayCapable);
    setViewMode(hasDisplayCapable ? "display" : "term");
  }

  // Reset to page 1 whenever the effective filter changes. Computed during
  // render (React's "adjusting state when a prop changes" pattern) rather
  // than in an effect, so there's no extra commit/flash.
  const filterKey = `${activeDictionaryIds.join(",")}|${activeTabs.join(",")}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const noteFilterKey = `${displayCapable.map((d) => d.id).join(",")}|${notePageSize}`;
  const [prevNoteFilterKey, setPrevNoteFilterKey] = useState(noteFilterKey);
  if (noteFilterKey !== prevNoteFilterKey) {
    setPrevNoteFilterKey(noteFilterKey);
    setNotePage(1);
  }

  const noFilters = activeDictionaryIds.length === 0 || activeTabs.length === 0;

  useEffect(() => {
    if (viewMode !== "term" || noFilters) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      dictionaryIds: activeDictionaryIds.join(","),
      pos: activeTabs.join(","),
      page: String(page),
    });

    startLoading(async () => {
      try {
        const res = await fetch(`/api/definitions?${params}`, { signal: controller.signal });
        const data = await res.json();
        setRows(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setRows([]);
      }
    });

    return () => controller.abort();
    // activeDictionaryIds/activeTabs are derived fresh each render; the
    // joined strings below are the real, primitive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeDictionaryIds.join(","), activeTabs.join(","), page, noFilters]);

  useEffect(() => {
    if (viewMode !== "display" || !hasDisplayCapable) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      dictionaryIds: displayCapable.map((d) => d.id).join(","),
      page: String(notePage),
      pageSize: String(notePageSize),
    });

    startLoadingNotes(async () => {
      try {
        const res = await fetch(`/api/notes?${params}`, { signal: controller.signal });
        const data = await res.json();
        setNotes(data.items ?? []);
        setNoteTotalPages(data.totalPages ?? 1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setNotes([]);
      }
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    displayCapable.map((d) => d.id).join(","),
    notePage,
    notePageSize,
    hasDisplayCapable,
    refreshToken,
  ]);

  function toggleDictionaryFilter(id: string) {
    setDeselectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleTab(tab: PartOfSpeech) {
    setActiveTabs((prev) =>
      prev.includes(tab) ? prev.filter((x) => x !== tab) : [...prev, tab],
    );
  }

  const primaryDisplayDictionaryId = displayCapable[0]?.id ?? null;

  async function moveNote(noteId: string, direction: "up" | "down") {
    await fetch("/api/notes/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, direction }),
    });
    setRefreshToken((t) => t + 1);
  }

  async function toggleVisibility(note: NoteRow) {
    const next = note.visibility === "public" ? "private" : "public";
    await fetch("/api/notes/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId: note.id, visibility: next }),
    });
    setRefreshToken((t) => t + 1);
  }

  async function deleteNote(noteId: string) {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    await fetch("/api/notes/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    setRefreshToken((t) => t + 1);
  }

  async function createNote() {
    if (!primaryDisplayDictionaryId) return;
    const content = newNoteBody.trim();
    if (!content) return;
    setIsAddingNote(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictionaryId: primaryDisplayDictionaryId, body: content }),
      });
      setNewNoteBody("");
      setRefreshToken((t) => t + 1);
    } finally {
      setIsAddingNote(false);
    }
  }

  async function openArchiveMode() {
    if (!primaryDisplayDictionaryId) return;
    const params = new URLSearchParams({
      dictionaryIds: primaryDisplayDictionaryId,
      page: "1",
      pageSize: "200",
    });
    const res = await fetch(`/api/notes?${params}`);
    const data = await res.json();
    setArchiveCandidates(data.items ?? []);
    setKeepIds(new Set());
    setArchiveLabel("");
    setArchiveMode(true);
  }

  function toggleKeep(noteId: string) {
    setKeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  function cancelArchiveMode() {
    setArchiveMode(false);
    setArchiveCandidates([]);
    setKeepIds(new Set());
  }

  async function confirmArchive() {
    if (!primaryDisplayDictionaryId) return;
    const noteIds = archiveCandidates.filter((n) => !keepIds.has(n.id)).map((n) => n.id);
    if (noteIds.length === 0) {
      cancelArchiveMode();
      return;
    }
    setIsArchiving(true);
    try {
      await fetch("/api/notes/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dictionaryId: primaryDisplayDictionaryId,
          noteIds,
          label: archiveLabel.trim() || null,
        }),
      });
      cancelArchiveMode();
      setNotePage(1);
      setRefreshToken((t) => t + 1);
    } finally {
      setIsArchiving(false);
    }
  }

  async function openArchiveBrowser() {
    if (!primaryDisplayDictionaryId) return;
    setShowArchives(true);
    setSelectedArchiveId(null);
    setArchiveNotes([]);
    setIsLoadingArchives(true);
    try {
      const res = await fetch(`/api/notes/archives?dictionaryId=${primaryDisplayDictionaryId}`);
      const data = await res.json();
      setArchives(data.items ?? []);
    } finally {
      setIsLoadingArchives(false);
    }
  }

  function closeArchiveBrowser() {
    setShowArchives(false);
    setSelectedArchiveId(null);
    setArchiveNotes([]);
  }

  async function selectArchive(archiveId: string) {
    if (!primaryDisplayDictionaryId) return;
    setSelectedArchiveId(archiveId);
    setIsLoadingArchives(true);
    try {
      const params = new URLSearchParams({
        dictionaryIds: primaryDisplayDictionaryId,
        archiveId,
        page: "1",
        pageSize: "200",
      });
      const res = await fetch(`/api/notes?${params}`);
      const data = await res.json();
      setArchiveNotes(data.items ?? []);
    } finally {
      setIsLoadingArchives(false);
    }
  }

  async function restoreNote(noteId: string) {
    await fetch("/api/notes/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    setArchiveNotes((prev) => prev.filter((n) => n.id !== noteId));
    setRefreshToken((t) => t + 1);
  }

  async function restoreAll(archiveId: string) {
    await fetch("/api/notes/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveId }),
    });
    closeArchiveBrowser();
    setRefreshToken((t) => t + 1);
  }

  if (dictionaries.length === 0) {
    return (
      <section className="px-6 py-6">
        <p className="text-sm text-neutral-400">
          Turn on a dictionary above to see its words.
        </p>
      </section>
    );
  }

  return (
    <section className="flex gap-6 border-b border-neutral-200 px-6 py-6">
      <aside className="flex w-40 shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-neutral-500">Dictionaries</h3>
          <button
            type="button"
            className="text-xs underline"
            onClick={() =>
              setDeselectedIds((prev) =>
                prev.length === 0 ? dictionaries.map((d) => d.id) : [],
              )
            }
          >
            {deselectedIds.length === 0 ? "None" : "All"}
          </button>
        </div>
        {dictionaries.map((d) => (
          <label key={d.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!deselectedIds.includes(d.id)}
              onChange={() => toggleDictionaryFilter(d.id)}
            />
            {d.name}
          </label>
        ))}
      </aside>

      <div className="flex flex-1 flex-col gap-4">
        {hasDisplayCapable && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("term")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                viewMode === "term"
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 text-neutral-600"
              }`}
            >
              Term View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("display")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                viewMode === "display"
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 text-neutral-600"
              }`}
            >
              Display View
            </button>
          </div>
        )}

        {viewMode === "term" ? (
          <>
            <div className="flex items-center gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => toggleTab(tab.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    activeTabs.includes(tab.key)
                      ? "bg-neutral-900 text-white"
                      : "border border-neutral-300 text-neutral-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {noFilters ? (
              <p className="text-sm text-neutral-400">
                Select at least one dictionary and one tab.
              </p>
            ) : isLoading ? (
              <p className="text-sm text-neutral-400">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-neutral-400">No definitions match.</p>
            ) : (
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                    <th className="w-40 py-2 pr-4">Word</th>
                    <th className="py-2">Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top">
                      <td className="py-2 pr-4 font-medium">
                        {row.term}
                        <span className="block text-xs text-neutral-400">{row.dictionaryName}</span>
                      </td>
                      <td className="py-2 text-neutral-700">{row.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="disabled:opacity-40"
              >
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
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-xs text-neutral-500">Per page</label>
              <select
                value={notePageSize}
                onChange={(e) => setNotePageSize(Number(e.target.value))}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
              >
                {NOTE_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              {hasDisplayCapable && !archiveMode && !showArchives && (
                <>
                  <button
                    type="button"
                    onClick={openArchiveMode}
                    className="ml-2 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600"
                  >
                    Archive all
                  </button>
                  <button
                    type="button"
                    onClick={openArchiveBrowser}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600"
                  >
                    View archives
                  </button>
                </>
              )}
            </div>

            {hasDisplayCapable && !archiveMode && !showArchives && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add a note..."
                  value={newNoteBody}
                  onChange={(e) => setNewNoteBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createNote();
                  }}
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={isAddingNote || !newNoteBody.trim()}
                  onClick={createNote}
                  className="shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}

            {!hasDisplayCapable ? (
              <p className="text-sm text-neutral-400">
                Select at least one dictionary.
              </p>
            ) : archiveMode ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-neutral-500">
                  Uncheck any notes you want to keep active. Everything checked will be archived
                  together.
                </p>
                <input
                  type="text"
                  placeholder="Optional label for this archive"
                  value={archiveLabel}
                  onChange={(e) => setArchiveLabel(e.target.value)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                <ul className="flex flex-col divide-y divide-neutral-100">
                  {archiveCandidates.map((note, index) => (
                    <li key={note.id} className="flex items-start gap-2 py-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!keepIds.has(note.id)}
                        onChange={() => toggleKeep(note.id)}
                      />
                      <span className="w-6 shrink-0 text-right text-xs font-medium text-neutral-400">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm" title={note.body}>
                        {note.body}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isArchiving}
                    onClick={confirmArchive}
                    className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Confirm archive
                  </button>
                  <button
                    type="button"
                    onClick={cancelArchiveMode}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : showArchives ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={closeArchiveBrowser}
                  className="self-start text-xs underline"
                >
                  Back to notes
                </button>
                {isLoadingArchives ? (
                  <p className="text-sm text-neutral-400">Loading...</p>
                ) : selectedArchiveId ? (
                  <>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedArchiveId(null)}
                        className="text-xs underline"
                      >
                        Back to archives
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreAll(selectedArchiveId)}
                        className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600"
                      >
                        Restore all
                      </button>
                    </div>
                    <ul className="flex flex-col divide-y divide-neutral-100">
                      {archiveNotes.map((note, index) => (
                        <li key={note.id} className="flex items-center gap-2 py-2">
                          <span className="w-6 shrink-0 text-right text-xs font-medium text-neutral-400">
                            {index + 1}
                          </span>
                          <p
                            className="min-w-0 flex-1 truncate text-sm text-neutral-700"
                            title={note.body}
                          >
                            {note.body}
                          </p>
                          <button
                            type="button"
                            onClick={() => restoreNote(note.id)}
                            className="shrink-0 text-xs underline"
                          >
                            Restore
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : archives.length === 0 ? (
                  <p className="text-sm text-neutral-400">No archives yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {archives.map((archive) => (
                      <li key={archive.id} className="py-2">
                        <button
                          type="button"
                          onClick={() => selectArchive(archive.id)}
                          className="text-left text-sm"
                        >
                          <span className="font-medium">
                            {archive.label || new Date(archive.createdAt).toLocaleString()}
                          </span>
                          <span className="ml-2 text-xs text-neutral-400">
                            {archive.noteCount} note(s)
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : isLoadingNotes ? (
              <p className="text-sm text-neutral-400">Loading...</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-neutral-400">No notes yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {notes.map((note, index) => (
                  <li key={note.id} className="flex items-center gap-3 py-2">
                    <span className="w-6 shrink-0 text-right text-xs font-medium text-neutral-400">
                      {(notePage - 1) * notePageSize + index + 1}
                    </span>
                    <p
                      className="min-w-0 flex-1 truncate text-sm text-neutral-700"
                      title={note.body}
                    >
                      {note.body}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveNote(note.id, "up")}
                        className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === notes.length - 1}
                        onClick={() => moveNote(note.id, "down")}
                        className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(note)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          note.visibility === "public"
                            ? "bg-neutral-900 text-white"
                            : "border border-neutral-300 text-neutral-600"
                        }`}
                      >
                        {note.visibility === "public" ? "Public" : "Private"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(note.id)}
                        className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-400 hover:border-red-300 hover:text-red-600"
                        aria-label="Delete note"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!archiveMode && !showArchives && (
              <div className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  disabled={notePage <= 1}
                  onClick={() => setNotePage((p) => p - 1)}
                  className="disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-neutral-500">
                  Page {notePage} of {noteTotalPages}
                </span>
                <button
                  type="button"
                  disabled={notePage >= noteTotalPages}
                  onClick={() => setNotePage((p) => p + 1)}
                  className="disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
