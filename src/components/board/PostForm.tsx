"use client";

import { useState } from "react";
import { kindOf, type BoardConfig, type BoardField } from "@/lib/boards";
import type { Board, Post } from "@/lib/posts";
import { NEIGHBORHOODS } from "@/lib/seattle";
import { hasContactInfo } from "@/lib/wording";
import { removeUploaded, uploadPhoto } from "@/lib/photos-client";
import { chip, input, link, primary, type Send } from "./parts";

type Draft = {
  kind: string;
  title: string;
  body: string;
  price: string;
  neighborhood: string;
  labels: string;
  details: Record<string, string>;
  photos: { path: string; url: string }[];
  organizationId: string;
};

export function draftFrom(post: Post | null, kind: string): Draft {
  if (!post) return { kind, title: "", body: "", price: "", neighborhood: "", labels: "", details: {}, photos: [], organizationId: "" };
  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(post.details)) if (typeof v === "string") details[k] = v;
  return {
    kind: post.kind,
    title: post.title,
    body: post.body,
    price: post.price,
    neighborhood: post.neighborhood,
    labels: post.labels.join(", "),
    details,
    photos: post.photos,
    organizationId: post.organization?.id ?? "",
  };
}

// The form for a new post or an edit, built from the kind's own fields.
export function PostForm({
  config,
  board,
  editing,
  startKind,
  send,
  onDone,
  kindNames,
}: {
  config: BoardConfig;
  board: Board;
  editing: Post | null;
  startKind?: string;
  send: Send;
  onDone: (id: string | null) => void;
  // Which kinds this form offers (a board can keep one kind for its own form).
  kindNames?: string[];
}) {
  const openKinds = board.kinds
    .filter((k) => (k.open || editing?.kind === k.name) && (!k.adultOnly || board.me.adultConfirmed))
    .map((k) => k.name)
    .filter((n) => !kindNames || kindNames.includes(n));
  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing, startKind ?? openKinds[0] ?? ""));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Photos uploaded in this form, removed again if it's cancelled.
  const [fresh, setFresh] = useState<string[]>([]);

  const kind = kindOf(config, draft.kind);
  const dbKind = board.kinds.find((k) => k.name === draft.kind);
  const set = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const setDetail = (key: string, value: string) => setDraft((d) => ({ ...d, details: { ...d.details, [key]: value } }));
  const labelList = draft.labels.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const room = config.photos - draft.photos.length;
      for (const file of [...files].slice(0, room)) {
        const path = await uploadPhoto(file, board.me.userId);
        setFresh((f) => [...f, path]);
        setDraft((d) => ({ ...d, photos: [...d.photos, { path, url: URL.createObjectURL(file) }] }));
      }
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!kind) return;
    setSaving(true);
    const post = { ...draft, photos: draft.photos.map((p) => p.path), organizationId: draft.organizationId || null };
    const res = await send(editing ? { action: "edit", id: editing.id, post } : { action: "add", post });
    setSaving(false);
    if (res) {
      setFresh([]);
      onDone((res.id as string) ?? null);
    }
  }

  function cancel() {
    removeUploaded(fresh);
    onDone(null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2.5 rounded-md bg-neutral-50 p-3"
    >
      {openKinds.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {openKinds.map((k) => (
            <button key={k} type="button" onClick={() => set({ kind: k })} className={chip(draft.kind === k)}>
              {k}
            </button>
          ))}
        </div>
      )}
      {dbKind?.description && <p className="text-xs text-neutral-600">{dbKind.description}</p>}

      <input
        value={draft.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder={kind?.titlePlaceholder ?? "Title"}
        aria-label="Title"
        maxLength={120}
        required
        className={input}
      />
      {kind?.price && (
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {kind.price.label}
          {kind.price.required ? "" : " (optional)"}
          <input
            value={draft.price}
            onChange={(e) => set({ price: e.target.value })}
            placeholder={kind.price.placeholder}
            maxLength={60}
            required={kind.price.required}
            className={`${input} sm:max-w-xs`}
          />
        </label>
      )}
      {kind?.fields.filter((f) => f.type !== "lines").map((f) => (
        <FieldInput key={f.key} field={f} value={draft.details[f.key] ?? ""} onChange={(v) => setDetail(f.key, v)} />
      ))}
      <textarea
        value={draft.body}
        onChange={(e) => set({ body: e.target.value })}
        placeholder={kind?.bodyPlaceholder ?? "Details"}
        aria-label="Details"
        rows={4}
        maxLength={5000}
        className={input}
      />
      {hasContactInfo(draft.body) && (
        <p className="text-xs text-neutral-600">Every signed-in spark can see a phone number or email in your post. Messages here keep yours private.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={draft.neighborhood}
          onChange={(e) => set({ neighborhood: e.target.value })}
          placeholder="Neighborhood"
          aria-label="Neighborhood"
          list="seattle-neighborhoods"
          maxLength={60}
          className={`${input} sm:w-48`}
        />
        <datalist id="seattle-neighborhoods">
          {NEIGHBORHOODS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <input
          value={draft.labels}
          onChange={(e) => set({ labels: e.target.value })}
          placeholder="Labels, with commas"
          aria-label="Labels"
          className={`${input} min-w-0 flex-1`}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {config.labels
          .filter((l) => !labelList.includes(l))
          .slice(0, 12)
          .map((l) => (
            <button key={l} type="button" onClick={() => set({ labels: [...labelList, l].join(", ") })} className="text-xs text-blue-700 underline">
              +{l}
            </button>
          ))}
      </div>

      {config.photos > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            {draft.photos.map((p) => (
              <div key={p.path} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-20 w-20 rounded object-cover" />
                <button
                  type="button"
                  onClick={() => set({ photos: draft.photos.filter((x) => x.path !== p.path) })}
                  className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-xs"
                  aria-label="Remove photo"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          {draft.photos.length < config.photos && (
            <label className="text-xs text-neutral-600">
              {uploading ? "Adding photo..." : `Add photos (up to ${config.photos}). They shrink before they upload, so they're light on data.`}
              <input type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => addPhotos(e.target.files)} className="mt-1 block text-xs" />
            </label>
          )}
          {photoError && <p className="text-xs text-red-700">{photoError}</p>}
        </div>
      )}

      {board.me.organizations.length > 0 && (
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          Post as
          <select value={draft.organizationId} onChange={(e) => set({ organizationId: e.target.value })} className={`${input} sm:max-w-xs`}>
            <option value="">Myself</option>
            {board.me.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || uploading || !draft.title.trim()} className={primary}>
          {editing ? "Save" : "Post"}
        </button>
        <button type="button" className={link} onClick={cancel}>
          Cancel
        </button>
        {dbKind?.expiresDays && !editing && <span className="text-xs text-neutral-500">Stays up {dbKind.expiresDays} days. You can renew it.</span>}
      </div>
    </form>
  );
}

export function FieldInput({ field, value, onChange }: { field: BoardField; value: string; onChange: (v: string) => void }) {
  const label = (
    <span>
      {field.label}
      {field.required ? "" : " (optional)"}
    </span>
  );
  if (field.type === "choice") {
    return (
      <div className="flex flex-col gap-1 text-xs text-neutral-600">
        {label}
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((o) => (
            <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? "" : o)} className={chip(value === o)}>
              {o}
            </button>
          ))}
        </div>
        {field.help && <span className="text-neutral-500">{field.help}</span>}
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600">
      {label}
      {field.type === "longtext" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={field.max ?? 2000} rows={3} className={input} />
      ) : (
        <input
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          min={field.type === "number" ? field.min : undefined}
          max={field.type === "number" ? field.max : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.type === "number" ? undefined : field.max ?? 200}
          required={field.required}
          className={`${input} ${field.type === "date" || field.type === "number" ? "w-44" : "sm:max-w-md"}`}
        />
      )}
      {field.help && <span className="text-neutral-500">{field.help}</span>}
    </label>
  );
}
