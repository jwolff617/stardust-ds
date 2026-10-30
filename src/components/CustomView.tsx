"use client";

import { useEffect, useState } from "react";
import type { CustomEntry, CustomField } from "@/lib/custom";
import { DeleteButton, Entry as EntryLine, UndoBar, chip, formatDate, input, link, primary, tag, useUndoDelete } from "./ui";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/custom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

// The one Display View for every dictionary someone built with Sage AI:
// an add form from its fields, search, label chips, and entries in the
// Stardust style. Click an entry to edit it.
export function CustomView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [entries, setEntries] = useState<CustomEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const refresh = () => setToken((t) => t + 1);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/custom?${new URLSearchParams({ dictionaryId: dictionary.id, q })}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setFields(data.fields);
          setEntries(data.entries);
          setLoaded(true);
          setError(null);
        })
        .catch((err) => (err as Error).name !== "AbortError" && setError((err as Error).message));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dictionary.id, q, token, reloadKey]);

  async function run(body: Record<string, unknown>) {
    setError(null);
    try {
      await post({ dictionaryId: dictionary.id, ...body });
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      refresh();
    }
  }

  const deleting = useUndoDelete<CustomEntry>((e) => run({ action: "delete", id: e.id }));
  const allLabels = [...new Set(entries.flatMap((e) => e.labels))].sort();
  const shown = deleting.hide(entries).filter((e) => labelFilter.every((l) => e.labels.includes(l)));
  const first = fields[0];

  return (
    <div className="flex flex-col gap-4">
      {first && <EntryForm fields={fields} onSave={(values, labels) => run({ action: "add", values, labels })} />}

      <div className="flex flex-col gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className={`${input} sm:max-w-xs`} />
        {allLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allLabels.map((l) => {
              const on = labelFilter.includes(l);
              return (
                <button key={l} type="button" aria-pressed={on} onClick={() => setLabelFilter(on ? labelFilter.filter((x) => x !== l) : [...labelFilter, l])} className={chip(on)}>
                  #{l}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {deleting.pending && first && <UndoBar text={deleting.pending.values[first.key] ?? ""} onUndo={deleting.undo} />}

      {!loaded ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-neutral-500">{entries.length === 0 ? "Nothing here yet. Add the first one above, or ask Sage." : "Nothing matches."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {shown.map((e) =>
            editingId === e.id ? (
              <li key={e.id} className="py-3">
                <EntryForm
                  fields={fields}
                  entry={e}
                  onSave={async (values, labels) => {
                    const ok = await run({ action: "edit", id: e.id, values, labels });
                    if (ok) setEditingId(null);
                    return ok;
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <EntryLine
                key={e.id}
                meta={
                  <>
                    <span>{formatDate(e.createdAt)}</span>
                    {e.labels.map((l) => (
                      <span key={l} className={tag}>
                        #{l}
                      </span>
                    ))}
                  </>
                }
                actions={
                  <>
                    <button type="button" className={link} onClick={() => setEditingId(e.id)}>
                      Edit
                    </button>
                    <DeleteButton onClick={() => deleting.remove(e)} />
                  </>
                }
              >
                <EntryBody fields={fields} entry={e} />
              </EntryLine>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

// The first field leads; the rest follow as label and answer.
function EntryBody({ fields, entry }: { fields: CustomField[]; entry: CustomEntry }) {
  const [first, ...rest] = fields;
  const show = (f: CustomField) => (f.type === "date" ? formatDate(entry.values[f.key]) : entry.values[f.key]);
  return (
    <div className="flex flex-col gap-0.5">
      {first && <p className="whitespace-pre-wrap font-medium">{show(first)}</p>}
      {rest
        .filter((f) => entry.values[f.key])
        .map((f) => (
          <p key={f.key} className="whitespace-pre-wrap">
            <span className="text-neutral-500">{f.label}: </span>
            {show(f)}
          </p>
        ))}
    </div>
  );
}

function EntryForm({
  fields,
  entry,
  onSave,
  onCancel,
}: {
  fields: CustomField[];
  entry?: CustomEntry;
  onSave: (values: Record<string, string>, labels: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(entry?.values ?? {});
  const [labels, setLabels] = useState(entry?.labels.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const first = fields[0];

  async function submit() {
    if (!first || !values[first.key]?.trim()) return;
    setSaving(true);
    const ok = await onSave(values, labels);
    setSaving(false);
    if (ok && !entry) {
      setValues({});
      setLabels("");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3"
    >
      {fields.map((f) => {
        const set = (v: string) => setValues((x) => ({ ...x, [f.key]: v }));
        const v = values[f.key] ?? "";
        return f.type === "longtext" ? (
          <textarea key={f.key} value={v} onChange={(e) => set(e.target.value)} placeholder={f.label} aria-label={f.label} rows={3} maxLength={5000} className={input} />
        ) : (
          <input
            key={f.key}
            type={f.type === "date" ? "date" : "text"}
            inputMode={f.type === "number" ? "decimal" : undefined}
            value={v}
            onChange={(e) => set(e.target.value)}
            placeholder={f.label}
            aria-label={f.label}
            maxLength={300}
            className={`${input} ${f.type === "date" || f.type === "number" ? "w-44" : ""}`}
          />
        );
      })}
      <input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="Labels, with commas (optional)" aria-label="Labels" className={input} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !first || !values[first.key]?.trim()} className={primary}>
          {entry ? "Save" : "+ New"}
        </button>
        {onCancel && (
          <button type="button" className={link} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
