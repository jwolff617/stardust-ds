"use client";

import { useEffect, useState } from "react";
import type { BasicApp, BasicField, BasicRecord } from "@/lib/basics";

const input = "rounded-md border border-neutral-300 px-2 py-1 text-sm";

// The Display View every basic app shares (Notepad, Address Book,
// Birthdays): an add form with the required fields, a search box, and a
// list in the app's order. Click a record to open it; fields save when
// they lose focus.
export function BasicsView({
  app,
  dictionary,
  reloadKey = 0,
}: {
  app: BasicApp;
  dictionary: { id: string; name: string };
  reloadKey?: number;
}) {
  const [items, setItems] = useState<BasicRecord[]>([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ dictionaryId: dictionary.id, kind: app.kind });
    fetch(`/api/basics?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setItems(data.items ?? []);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      });
    return () => controller.abort();
  }, [dictionary.id, app.kind, refreshToken, reloadKey]);

  async function send(body: Record<string, unknown>): Promise<BasicRecord | null> {
    setError(null);
    try {
      const res = await fetch("/api/basics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictionaryId: dictionary.id, kind: app.kind, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      return data.item ?? null;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setRefreshToken((t) => t + 1);
    }
  }

  const required = app.fields.filter((f) => f.required);
  const q = query.trim().toLowerCase();
  const shown = q
    ? items.filter((r) => app.fields.some((f) => f.type !== "integer" && String(r[f.key] ?? "").toLowerCase().includes(q)))
    : items;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const item = await send({ record: draft });
          if (item) {
            setDraft({});
            if (app.fields.some((f) => !f.required)) setOpenId(item.id);
          }
        }}
        className="flex flex-wrap items-center gap-2"
      >
        {required.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={draft[f.key] ?? ""}
            placeholder={f.key === app.titleField ? app.addLabel : f.label}
            onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
          />
        ))}
        <button type="submit" className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium">
          Add
        </button>
        {items.length > 5 && (
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find" className={`${input} ml-auto w-40`} />
        )}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {shown.length === 0 && <p className="text-sm text-neutral-400">{items.length === 0 ? "Nothing here yet." : "No matches."}</p>}

      {shown.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 border-b border-neutral-100 pb-2">
          <button type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)} className="flex flex-col text-left">
            <span className="text-sm font-medium">{String(r[app.titleField] ?? "")}</span>
            {app.subtitle && app.subtitle(r) && <span className="text-xs text-neutral-500">{app.subtitle(r)}</span>}
          </button>

          {openId === r.id && (
            <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
              <div className="flex flex-wrap gap-2">
                {app.fields
                  .filter((f) => f.type !== "longtext")
                  .map((f) => (
                    <label key={f.key} className="flex flex-col gap-1 text-xs text-neutral-500">
                      {f.label}
                      <RecordField record={r} field={f} onSave={(v) => send({ record: { id: r.id, [f.key]: v } })} />
                    </label>
                  ))}
              </div>
              {app.fields
                .filter((f) => f.type === "longtext")
                .map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-xs text-neutral-500">
                    {f.label}
                    <RecordField record={r} field={f} onSave={(v) => send({ record: { id: r.id, [f.key]: v } })} />
                  </label>
                ))}
              <button
                type="button"
                onClick={() => window.confirm(`Delete ${String(r[app.titleField])}?`) && send({ deleteId: r.id })}
                className="self-start text-xs text-neutral-400 underline hover:text-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  placeholder,
  onChange,
}: {
  field: BasicField;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type={field.type === "integer" ? "number" : "text"}
      min={field.min}
      max={field.type === "integer" ? field.max : undefined}
      maxLength={field.type === "integer" ? undefined : field.max}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${input} ${field.type === "integer" ? "w-20" : "min-w-0 flex-1"}`}
    />
  );
}

// One saved field. Keyed on its value so a reload shows what was saved.
function RecordField({ record, field, onSave }: { record: BasicRecord; field: BasicField; onSave: (value: string) => void }) {
  const saved = record[field.key] === null || record[field.key] === undefined ? "" : String(record[field.key]);
  const save = (value: string) => value.trim() !== saved && onSave(value);

  if (field.type === "longtext") {
    return (
      <textarea
        key={saved}
        defaultValue={saved}
        rows={field.max && field.max > 5000 ? 12 : 3}
        maxLength={field.max}
        onBlur={(e) => save(e.target.value)}
        className={`${input} text-neutral-900`}
      />
    );
  }
  return (
    <input
      key={saved}
      type={field.type === "integer" ? "number" : "text"}
      min={field.min}
      max={field.type === "integer" ? field.max : undefined}
      maxLength={field.type === "integer" ? undefined : field.max}
      defaultValue={saved}
      onBlur={(e) => save(e.target.value)}
      className={`${input} text-neutral-900 ${field.type === "integer" ? "w-20" : "w-56"}`}
    />
  );
}
