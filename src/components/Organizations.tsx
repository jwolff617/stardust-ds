"use client";

import { useEffect, useState } from "react";
import {
  applyOfficial,
  createOrganization,
  deleteOrganization,
  myOrganizations,
  officialQueue,
  reviewOrganization,
  saveOrganization,
  type Organization,
} from "@/app/actions/organizations";
import { input, link, primary, quiet } from "./ui";

const KINDS = [
  { key: "nonprofit", label: "Nonprofit" },
  { key: "government", label: "Government" },
  { key: "business", label: "Business" },
];

const STATUS: Record<Organization["status"], string> = {
  unverified: "Not Official yet",
  applied: "Waiting for a moderator",
  official: "Official",
};

type Fields = { name: string; kind: string; website: string; about: string };
const EMPTY: Fields = { name: "", kind: "nonprofit", website: "", about: "" };

function OrgForm({ start, button, onSave, onCancel }: { start: Fields; button: string; onSave: (f: Fields) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await onSave(f);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
      className="flex flex-col gap-2 text-xs text-neutral-600"
    >
      <div className="flex flex-wrap gap-2">
        <input autoFocus value={f.name} onChange={set("name")} maxLength={80} placeholder="Recovery Cafe" aria-label="Name" className={`${input} min-w-0 flex-1`} />
        <select value={f.kind} onChange={set("kind")} aria-label="Kind" className={input}>
          {KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <input value={f.website} onChange={set("website")} maxLength={200} placeholder="Website (helps you get Official)" aria-label="Website" className={input} />
      <textarea value={f.about} onChange={set("about")} maxLength={1000} rows={2} placeholder="What you do, in a line or two" aria-label="About" className={`${input} resize-y`} />
      <div className="flex gap-2">
        <button type="submit" disabled={!f.name.trim()} className={primary}>
          {button}
        </button>
        <button type="button" onClick={onCancel} className={link}>
          Cancel
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}

// Your organizations: make one, write as it right away, apply for Official.
export function Organizations({ onClose }: { onClose: () => void }) {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    myOrganizations()
      .then((o) => {
        setOrgs(o);
        if (o.length === 0) setAdding(true);
      })
      .catch((err) => setError((err as Error).message));
  }, [token]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      setAdding(false);
      setEditingId(null);
      setToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-300 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Organizations</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto px-1 text-neutral-400 hover:text-neutral-900">
          ✕
        </button>
      </div>
      <p className="text-xs text-neutral-600">
        Run a nonprofit, a community group, or a public office? Make it here and post ideas, resources, and jobs as it right away.
        Apply for Official and a moderator checks it&apos;s real. Official organizations show first, with the tag.
      </p>

      {orgs?.map((o) =>
        editingId === o.id ? (
          <OrgForm key={o.id} start={o} button="Save" onSave={(f) => run(() => saveOrganization(o.id, f))} onCancel={() => setEditingId(null)} />
        ) : (
          <div key={o.id} className="flex flex-col gap-1.5 border-t border-neutral-100 pt-2">
            <p className="text-sm font-medium">
              {o.name}
              <span className={`ml-2 text-[10px] uppercase tracking-wide ${o.status === "official" ? "text-emerald-700" : "text-neutral-500"}`}>
                {STATUS[o.status]}
              </span>
            </p>
            {o.about && <p className="text-xs text-neutral-600">{o.about}</p>}
            <div className="flex flex-wrap gap-2">
              {o.status === "unverified" && (
                <button type="button" onClick={() => run(() => applyOfficial(o.id))} className={primary}>
                  Apply for Official
                </button>
              )}
              <button type="button" onClick={() => setEditingId(o.id)} className={quiet}>
                Edit
              </button>
              <button
                type="button"
                onClick={() => window.confirm(`Delete ${o.name}? Its posts stay, under your name.`) && run(() => deleteOrganization(o.id))}
                className={link}
              >
                Delete
              </button>
            </div>
          </div>
        ),
      )}

      {adding ? (
        <OrgForm start={EMPTY} button="Make it" onSave={(f) => run(() => createOrganization(f))} onCancel={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${link} self-start`}>
          + New organization
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// For moderators, in Moderate: approve or send back, and take Official away.
export function OfficialQueue() {
  const [q, setQ] = useState<{ waiting: Organization[]; official: Organization[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    officialQueue()
      .then(setQ)
      .catch((err) => setError((err as Error).message));
  }, [token]);

  const review = async (o: Organization, approve: boolean) => {
    if (!approve && o.status === "official" && !window.confirm(`Take Official away from ${o.name}?`)) return;
    setError(null);
    try {
      await reviewOrganization(o.id, approve);
      setToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!q) return <p className="text-xs text-neutral-400">{error ?? "Loading Official requests..."}</p>;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
      <p className="text-xs font-semibold text-emerald-900">Official requests ({q.waiting.length})</p>
      {q.waiting.length === 0 && <p className="text-xs text-neutral-500">Nobody waiting.</p>}
      {q.waiting.map((o) => (
        <div key={o.id} className="flex flex-col gap-1 border-t border-emerald-100 pt-2 text-xs">
          <p className="text-sm font-medium">
            {o.name} <span className="text-neutral-500">· {o.kind}</span>
          </p>
          {o.website && (
            <a href={/^https?:\/\//.test(o.website) ? o.website : `https://${o.website}`} target="_blank" rel="noreferrer" className={link}>
              {o.website}
            </a>
          )}
          {o.about && <p className="text-neutral-700">{o.about}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => review(o, true)} className={primary}>
              Make Official
            </button>
            <button type="button" onClick={() => review(o, false)} className={quiet}>
              Send back
            </button>
          </div>
        </div>
      ))}
      {q.official.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-neutral-600">Official now ({q.official.length})</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {q.official.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                {o.name}
                <button type="button" onClick={() => review(o, false)} className={link}>
                  Take away
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
