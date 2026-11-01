"use client";

import { useState } from "react";
import { createListing, saveListing } from "@/app/actions/listings";
import type { CustomField } from "@/lib/custom";
import { input, link, primary } from "./ui";

// Make or edit a listing: a name, then the search's fields. New listings
// carry the search's labels, plus any added here.
export function ListingForm({
  searchId,
  noun,
  fields,
  listing,
  onSaved,
  onCancel,
}: {
  searchId?: string;
  noun: string;
  fields: CustomField[];
  listing?: { id: string; name: string; values: Record<string, string> };
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(listing?.name ?? "");
  const [values, setValues] = useState<Record<string, string>>(listing?.values ?? {});
  const [labels, setLabels] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError(`Give your ${noun} a name.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (listing) {
        await saveListing(listing.id, name, values);
        onSaved(listing.id);
      } else if (searchId) {
        onSaved(await createListing(searchId, name, values, labels));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2.5 rounded-lg border border-neutral-300 bg-white p-3 shadow-sm"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Name your ${noun}`}
        aria-label="Name"
        maxLength={80}
        className={`${input} text-base font-medium`}
      />
      {fields.map((f) => {
        const v = values[f.key] ?? "";
        const set = (next: string) => setValues((x) => ({ ...x, [f.key]: next }));
        return (
          <label key={f.key} className="flex flex-col gap-1 text-xs text-neutral-600">
            {f.label}
            {f.type === "longtext" ? (
              <textarea value={v} onChange={(e) => set(e.target.value)} rows={3} maxLength={5000} className={input} />
            ) : (
              <input
                type={f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                value={v}
                onChange={(e) => set(e.target.value)}
                maxLength={300}
                className={input}
              />
            )}
          </label>
        );
      })}
      {!listing && (
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          More labels (optional, with commas)
          <input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="housing, kids" className={input} />
        </label>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={primary}>
          {saving ? "Saving..." : listing ? "Save" : `Share ${noun}`}
        </button>
        <button type="button" onClick={onCancel} className={link}>
          Cancel
        </button>
        {!listing && <span className="ml-auto text-xs text-neutral-400">Signed-in people can see it right away.</span>}
      </div>
    </form>
  );
}
