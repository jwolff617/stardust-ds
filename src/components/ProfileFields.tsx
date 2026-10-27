"use client";

import { useEffect, useState, useTransition } from "react";

type ProfileDictionary = { id: string; name: string };
type FieldRow = {
  id: string;
  dictionaryId: string;
  name: string;
  value: string;
  visibility: "public" | "private";
  mine: boolean;
};

// Display View for Private and Public Profile dictionaries: name/value
// fields. Your own fields are editable; another spark's show only what
// they made public.
export function ProfileFields({ dictionaries, reloadKey = 0 }: { dictionaries: ProfileDictionary[]; reloadKey?: number }) {
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const idsKey = dictionaries.map((d) => d.id).join(",");

  useEffect(() => {
    if (!idsKey) return;
    const controller = new AbortController();

    startLoading(async () => {
      try {
        const res = await fetch(`/api/profile-fields?dictionaryIds=${idsKey}`, { signal: controller.signal });
        const data = await res.json();
        setFields(data.items ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFields([]);
      }
    });

    return () => controller.abort();
  }, [idsKey, reloadKey]);

  async function save(field: FieldRow, update: { value?: string; visibility?: "public" | "private" }) {
    const previous = fields;
    setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, ...update } : f)));
    setError(null);

    const res = await fetch("/api/profile-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldId: field.id, ...update }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFields(previous);
      setError(data.error ?? "Couldn't save that field.");
    }
  }

  if (isLoading) return <p className="text-sm text-neutral-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {dictionaries.map((dictionary) => {
        const rows = fields.filter((f) => f.dictionaryId === dictionary.id);
        const isPrivateProfile = dictionary.name.endsWith("Private Profile");
        return (
          <div key={dictionary.id} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>
            {rows.length === 0 ? (
              <p className="text-sm text-neutral-400">No fields to show.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {rows.map((field) => (
                  <li key={field.id} className="flex items-center gap-3 py-2">
                    <span className="w-40 shrink-0 text-sm font-medium">{field.name}</span>
                    {field.mine ? (
                      <input
                        type="text"
                        defaultValue={field.value}
                        maxLength={500}
                        onBlur={(e) => {
                          if (e.target.value.trim() !== field.value) save(field, { value: e.target.value });
                        }}
                        className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{field.value}</span>
                    )}
                    {field.mine && !isPrivateProfile && (
                      <button
                        type="button"
                        onClick={() =>
                          save(field, { visibility: field.visibility === "public" ? "private" : "public" })
                        }
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          field.visibility === "public"
                            ? "bg-neutral-900 text-white"
                            : "border border-neutral-300 text-neutral-600"
                        }`}
                      >
                        {field.visibility === "public" ? "Public" : "Private"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isPrivateProfile && (
              <p className="text-xs text-neutral-400">
                Only you can see this. Payment Customer ID holds a reference from a payment processor. Card
                numbers stay with the processor.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
