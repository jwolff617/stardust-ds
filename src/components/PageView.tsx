"use client";

import { useEffect, useState } from "react";
import { input, link, primary, quiet } from "./ui";

type Page = { tagline?: string; about?: string; highlights?: string; coming?: string; contact?: string; email?: string; link?: string };
type Data = { name: string; description: string; page: Page; status: string; mine: boolean; isModerator: boolean };

const EDIT_FIELDS: { key: keyof Page; label: string; long?: boolean; placeholder: string }[] = [
  { key: "tagline", label: "Tagline", placeholder: "One line people remember" },
  { key: "about", label: "What it is", long: true, placeholder: "A few lines on what it is and who it's for" },
  { key: "highlights", label: "Highlights", long: true, placeholder: "One per line" },
  { key: "coming", label: "Coming next", long: true, placeholder: "What's on the way" },
  { key: "contact", label: "Contact name", placeholder: "Who to reach" },
  { key: "email", label: "Email", placeholder: "Optional. Everyone can see it once Official." },
  { key: "link", label: "Website", placeholder: "urbanwolfstudio.net" },
];

const STATUS_TEXT: Record<string, string> = {
  draft: "Only you can see this page. Apply for Official to show it to everyone.",
  applied: "Waiting for a moderator. Once approved it shows in everyone's Library as Official.",
  official: "Official. Everyone can find this page in the Library.",
};

// A Business Page: a dictionary that reads like an official website.
export function PageView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/pages?dictionaryId=${dictionary.id}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((err) => (err as Error).name !== "AbortError" && setError("Couldn't load this page."));
    return () => controller.abort();
  }, [dictionary.id, token, reloadKey]);

  async function run(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dictionaryId: dictionary.id, ...body }),
    });
    const d = await res.json().catch(() => ({}));
    setToken((t) => t + 1);
    if (!res.ok) {
      setError(d.error ?? "Something went wrong.");
      return false;
    }
    return true;
  }

  if (!data) return <p className="text-sm text-neutral-500">{error ?? "Loading..."}</p>;
  const p = data.page;
  const highlights = (p.highlights ?? "").split("\n").map((h) => h.trim()).filter(Boolean);

  if (editing) return <PageEditor data={data} onCancel={() => setEditing(false)} onSave={async (b) => (await run({ action: "save", ...b })) && setEditing(false)} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-lg bg-neutral-900 px-5 py-6 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">{data.name}</h3>
          {data.status === "official" && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-900">Official</span>
          )}
          {data.mine && (
            <button type="button" onClick={() => setEditing(true)} className="ml-auto rounded-full border border-white/40 px-3 py-0.5 text-xs text-white hover:bg-white/10">
              Edit
            </button>
          )}
        </div>
        {p.tagline && <p className="text-base text-neutral-200">{p.tagline}</p>}
      </div>

      {p.about && <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{p.about}</p>}

      {highlights.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {highlights.map((h) => (
            <li key={h} className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800">
              <span aria-hidden className="mr-1.5 text-amber-600">✦</span>
              {h}
            </li>
          ))}
        </ul>
      )}

      {p.coming && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-wide">Coming next</p>
          <p className="whitespace-pre-wrap">{p.coming}</p>
        </div>
      )}

      {(p.contact || p.email || p.link) && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {p.contact && <span className="text-neutral-600">{p.contact}</span>}
          {p.email && (
            <a href={`mailto:${p.email}`} className="text-blue-700 underline">
              {p.email}
            </a>
          )}
          {p.link && (
            <a href={p.link} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              {p.link.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data.mine && (
        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
          <span>{STATUS_TEXT[data.status]}</span>
          {data.status === "draft" && (
            <button type="button" className={`${primary} ml-auto`} onClick={() => run({ action: "apply" })}>
              Apply for Official
            </button>
          )}
        </div>
      )}

      {data.isModerator && data.status === "applied" && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <span className="text-blue-950">This page applied for Official.</span>
          <div className="ml-auto flex gap-2">
            <button type="button" className={quiet} onClick={() => run({ action: "sendBack" })}>
              Send back
            </button>
            <button type="button" className={primary} onClick={() => run({ action: "approve" })}>
              Approve as Official
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PageEditor({ data, onSave, onCancel }: { data: Data; onSave: (b: { name: string; description: string; page: Page }) => void; onCancel: () => void }) {
  const [name, setName] = useState(data.name);
  const [description, setDescription] = useState(data.description);
  const [page, setPage] = useState<Page>(data.page);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, description, page });
      }}
      className="flex flex-col gap-2.5 rounded-md border border-neutral-200 p-3"
    >
      <label className="flex flex-col gap-1 text-xs text-neutral-600">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-neutral-600">
        Library line (shows when people hover it in the Library)
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className={input} />
      </label>
      {EDIT_FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-xs text-neutral-600">
          {f.label}
          {f.long ? (
            <textarea value={page[f.key] ?? ""} onChange={(e) => setPage((x) => ({ ...x, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={3} className={input} />
          ) : (
            <input value={page[f.key] ?? ""} onChange={(e) => setPage((x) => ({ ...x, [f.key]: e.target.value }))} placeholder={f.placeholder} className={input} />
          )}
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button type="submit" className={primary}>
          Save
        </button>
        <button type="button" className={link} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
