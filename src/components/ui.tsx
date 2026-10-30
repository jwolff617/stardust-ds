"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The Stardust style: one look for every dictionary's Display View.
// See dictionaries/STYLE_GUIDE.md. Use these instead of writing new
// classes, so a note in Night DS and a story in Worthy read the same.

export const input = "rounded-md border border-neutral-300 px-2 py-1.5 text-sm";
export const primary = "rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40";
export const quiet = "rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-40";
export const link = "text-xs text-neutral-600 underline";
export const chip = (on: boolean) => `rounded-full px-2.5 py-1 text-xs ${on ? "bg-blue-600 text-white" : "border border-neutral-300 text-neutral-700"}`;
export const tag = "rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600";

// One date format everywhere: "Oct 29", with the year only when it isn't
// this year, and the time only where the time matters.
export function formatDate(value: string | null, withTime = false): string {
  if (!value) return "";
  // A plain date (2026-10-29) is that day where you are, not UTC midnight.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
  return withTime ? `${date}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : date;
}

// One entry: what you wrote first, then one quiet line of when and tags,
// with its buttons at the end of that line.
export function Entry({ children, meta, actions }: { children: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="text-sm text-neutral-800">{children}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        {meta}
        {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
      </div>
    </li>
  );
}

// The ✕, set apart from the other buttons so a slip doesn't hit it.
export function DeleteButton({ onClick, what = "entry" }: { onClick: () => void; what?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-3 border-l border-neutral-200 pl-4 text-neutral-400 hover:text-red-600"
      aria-label={`Delete ${what}`}
      title="Delete (you can undo)"
    >
      ✕
    </button>
  );
}

const UNDO_SECONDS = 8;

// Delete with Undo: the item hides at once and is deleted for good after a
// few seconds. Leaving the page deletes it then.
export function useUndoDelete<T extends { id: string }>(commit: (item: T) => void) {
  const [pending, setPending] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  const finish = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const item = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (item) commitRef.current(item);
  };

  const remove = (item: T) => {
    finish();
    pendingRef.current = item;
    setPending(item);
    timer.current = setTimeout(finish, UNDO_SECONDS * 1000);
  };

  const undo = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pendingRef.current = null;
    setPending(null);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pendingRef.current) commitRef.current(pendingRef.current);
    },
    [],
  );

  const hide = <U extends { id: string }>(items: U[]) => (pending ? items.filter((i) => i.id !== pending.id) : items);
  return { pending, remove, undo, hide };
}

export function UndoBar({ text, onUndo }: { text: string; onUndo: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white">
      <span className="min-w-0 flex-1 truncate">Deleted &ldquo;{text}&rdquo;</span>
      <button type="button" onClick={onUndo} className="font-semibold underline">
        Undo
      </button>
    </div>
  );
}
