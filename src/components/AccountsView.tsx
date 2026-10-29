"use client";

import { useEffect, useState, useTransition } from "react";
import { ACCOUNT_GROUPS, type AccountName } from "@/lib/accounts";

type AccountsDictionary = { id: string; name: string };
type Entry = {
  id: string;
  account: AccountName;
  // Quantity: a number or a word. Stored in the amount column.
  amount: string | null;
  note: string | null;
  createdAt: string;
};

// Accounts DS Display View: like a bank account that holds more than
// money. Each account keeps dated entries and shows its balance.
export function AccountsView({ dictionary, reloadKey = 0 }: { dictionary: AccountsDictionary; reloadKey?: number }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<AccountName>("Savings");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    startLoading(async () => {
      try {
        const res = await fetch(`/api/accounts?dictionaryId=${dictionary.id}`, { signal: controller.signal });
        const data = await res.json();
        setEntries(data.items ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setEntries([]);
      }
    });
    return () => controller.abort();
  }, [dictionary.id, refreshToken, reloadKey]);

  function balanceOf(account: AccountName) {
    const rows = entries.filter((e) => e.account === account);
    return { count: rows.length };
  }

  async function addEntry() {
    if (!amount.trim() && !note.trim()) return;
    setIsSaving(true);
    setError(null);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dictionaryId: dictionary.id, account: selected, amount: amount.trim(), note }),
    });
    if (res.ok) {
      setAmount("");
      setNote("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that entry.");
    }
    setIsSaving(false);
    setRefreshToken((t) => t + 1);
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm("Delete this entry for good?")) return;
    await fetch("/api/accounts/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    setRefreshToken((t) => t + 1);
  }

  const selectedEntries = entries.filter((e) => e.account === selected);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>

      {/* Imagination on top, the Matrix at the base. */}
      <div className="flex flex-col gap-3">
        {[...ACCOUNT_GROUPS].reverse().map(({ group, accounts }) => (
          <div key={group} className="flex flex-col gap-1">
            <p className="text-xs text-neutral-400">{group}</p>
            <div className="grid grid-cols-3 gap-2">
              {accounts.map((account) => {
                const { count } = balanceOf(account);
                return (
                  <button
                    key={account}
                    type="button"
                    onClick={() => setSelected(account)}
                    className={`flex flex-col items-start rounded-md border px-3 py-2 text-left ${
                      selected === account ? "border-neutral-900" : "border-neutral-200"
                    }`}
                  >
                    <span className="text-sm font-medium">{account}</span>
                    <span className="text-xs text-neutral-500">
                      {count} {count === 1 ? "entry" : "entries"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
        <p className="text-sm font-medium">{selected}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={amount}
            maxLength={60}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Quantity (optional)"
            className="w-36 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addEntry();
            }}
            placeholder="Note"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={isSaving || (!amount.trim() && !note.trim())}
            onClick={addEntry}
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            Add entry
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : selectedEntries.length === 0 ? (
          <p className="text-sm text-neutral-400">No entries yet. Add the first one above.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {selectedEntries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-36 shrink-0 text-xs text-neutral-400">
                  {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </span>
                {entry.amount !== null && <span className="w-20 shrink-0 font-medium">{entry.amount}</span>}
                <span className="min-w-0 flex-1 text-neutral-700">{entry.note}</span>
                <button
                  type="button"
                  onClick={() => deleteEntry(entry.id)}
                  className="text-neutral-400 hover:text-red-600"
                  aria-label="Delete entry"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
