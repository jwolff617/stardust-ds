"use client";

import { useState } from "react";
import { createNotebook } from "@/app/actions/dictionaries";
import { input, link, primary } from "./ui";

type Style = "notepad" | "night" | "journal";

const STYLES: { style: Style; title: string; about: string; placeholder: string }[] = [
  { style: "notepad", title: "Notepad", about: "Notes that stay until you delete them.", placeholder: "Book ideas" },
  { style: "night", title: "Night Notes", about: "Notes that let go when their time is up.", placeholder: "Tonight's worries" },
  { style: "journal", title: "Journal", about: "Dated entries about your day, newest first.", placeholder: "Morning pages" },
];

// "New notebook": pick Notepad, Night Notes, or Journal, name it, write.
// Private to you.
export function NewNotebook({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [style, setStyle] = useState<Style | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = STYLES.find((s) => s.style === style);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-300 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        {picked && (
          <button type="button" onClick={() => setStyle(null)} className={link}>
            ← Back
          </button>
        )}
        <h3 className="text-sm font-semibold">{picked ? `New ${picked.title}` : "New notebook"}</h3>
        <span className="text-xs text-neutral-400">Private to you</span>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto px-1 text-neutral-400 hover:text-neutral-900">
          ✕
        </button>
      </div>

      {!picked && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {STYLES.map((s) => (
            <li key={s.style}>
              <button
                type="button"
                onClick={() => setStyle(s.style)}
                className="flex h-full w-full flex-col gap-1 rounded-md border border-neutral-200 px-3 py-2.5 text-left hover:border-neutral-900"
              >
                <span className="text-sm font-medium">{s.title}</span>
                <span className="text-xs text-neutral-600">{s.about}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            try {
              await createNotebook(picked.style, name);
              onDone();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setSaving(false);
            }
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={picked.placeholder}
            aria-label="Name"
            className={`${input} min-w-0 flex-1`}
          />
          <button type="submit" disabled={saving || !name.trim()} className={primary}>
            Make it
          </button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
