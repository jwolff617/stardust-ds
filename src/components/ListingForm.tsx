"use client";

import { useEffect, useRef, useState } from "react";
import { createListing, saveListing, whoAmI } from "@/app/actions/listings";
import type { CustomField } from "@/lib/custom";
import type { Photo } from "@/lib/listings";
import { removeUploaded, uploadPhoto } from "@/lib/photos-client";
import { input, link, primary } from "./ui";

// Make or edit a listing: photos (where the search allows them), a name,
// then the search's fields. New listings carry the search's labels, plus
// any added here.
export function ListingForm({
  searchId,
  noun,
  fields,
  photoLimit = 0,
  lastsDays = null,
  listing,
  onSaved,
  onCancel,
}: {
  searchId?: string;
  noun: string;
  fields: CustomField[];
  photoLimit?: number;
  lastsDays?: number | null;
  listing?: { id: string; name: string; values: Record<string, string>; photos: Photo[] };
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(listing?.name ?? "");
  const [values, setValues] = useState<Record<string, string>>(listing?.values ?? {});
  const [labels, setLabels] = useState("");
  const [photos, setPhotos] = useState<Photo[]>(listing?.photos ?? []);
  // Photos uploaded in this form, removed again if it's cancelled.
  const fresh = useRef<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (photoLimit > 0) whoAmI().then(setUserId).catch(() => {});
  }, [photoLimit]);

  async function addPhotos(files: FileList | null) {
    if (!files || !userId) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of [...files].slice(0, photoLimit - photos.length)) {
        const path = await uploadPhoto(file, userId);
        fresh.current.push(path);
        setPhotos((p) => [...p, { path, url: URL.createObjectURL(file) }]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!name.trim()) {
      setError(`Give your ${noun} a name.`);
      return;
    }
    setSaving(true);
    setError(null);
    const paths = photos.map((p) => p.path);
    try {
      if (listing) {
        await saveListing(listing.id, name, values, paths);
        // Photos taken out in this edit go from storage too.
        const gone = listing.photos.map((p) => p.path).filter((p) => !paths.includes(p));
        removeUploaded(gone).catch(() => {});
        onSaved(listing.id);
      } else if (searchId) {
        onSaved(await createListing(searchId, name, values, labels, paths));
      }
      fresh.current = [];
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    removeUploaded(fresh.current).catch(() => {});
    onCancel();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2.5 rounded-lg border border-neutral-300 bg-white p-3 shadow-sm"
    >
      {photoLimit > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-20 w-20 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((ps) => ps.filter((x) => x.path !== p.path))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length < photoLimit && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-neutral-300 text-center text-[11px] text-neutral-500 hover:border-neutral-900">
              {uploading ? "Adding..." : `+ Photo${photoLimit > 1 ? ` (${photos.length}/${photoLimit})` : ""}`}
              <input type="file" accept="image/*" multiple={photoLimit > 1} disabled={uploading || !userId} onChange={(e) => addPhotos(e.target.files)} className="hidden" />
            </label>
          )}
        </div>
      )}
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
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || uploading} className={primary}>
          {saving ? "Saving..." : listing ? "Save" : `Share ${noun}`}
        </button>
        <button type="button" onClick={cancel} className={link}>
          Cancel
        </button>
        {!listing && (
          <span className="ml-auto text-xs text-neutral-400">
            Signed-in people see it right away{lastsDays ? `. It runs ${lastsDays} days, and you can renew it` : ""}.
          </span>
        )}
      </div>
    </form>
  );
}
