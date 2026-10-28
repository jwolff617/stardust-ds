"use client";

import { useEffect, useState } from "react";
import { AGES } from "@/lib/wolffie/shared";

type Theme = { id: string; name: string };
type PacketSummary = { id: string; title: string; themes: string[]; kids: number; age: number; createdAt: string };

// Wolffie Games Display View: pick or type themes, set the group, generate.
// Each packet opens as printable pages at /wolffie/<id>.
export function WolffieGamesView({ dictionary, reloadKey = 0 }: { dictionary: { id: string; name: string }; reloadKey?: number }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [packets, setPackets] = useState<PacketSummary[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [newTheme, setNewTheme] = useState("");
  const [kids, setKids] = useState("15");
  const [age, setAge] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [madeId, setMadeId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/wolffie?dictionaryId=${dictionary.id}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setThemes(data.themes ?? []);
        setPackets(data.packets ?? []);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      });
    return () => controller.abort();
  }, [dictionary.id, refreshToken, reloadKey]);

  async function send(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/wolffie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dictionaryId: dictionary.id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  const toggle = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));

  async function addTheme() {
    const name = newTheme.trim();
    if (!name) return;
    try {
      await send({ action: "addTheme", name });
      setNewTheme("");
      setPicked((p) => (p.includes(name) ? p : [...p, name]));
      setRefreshToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function generate() {
    // A theme typed but not added still counts.
    const chosen = [...picked, ...(newTheme.trim() ? [newTheme.trim()] : [])];
    setBusy(true);
    setMadeId(null);
    try {
      const { id } = await send({ action: "generate", themes: chosen, kids: Number(kids), age: Number(age) });
      setMadeId(id);
      setRefreshToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function remove(action: "deleteTheme" | "deletePacket", id: string) {
    try {
      await send({ action, id });
      setRefreshToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const input = "rounded border border-neutral-300 px-2 py-1 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium text-neutral-500">{dictionary.name}</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Themes (pick one or more)</span>
          <div className="flex flex-wrap gap-1.5">
            {themes.map((t) => (
              <span key={t.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggle(t.name)}
                  aria-pressed={picked.includes(t.name)}
                  className={`rounded-l-full px-2.5 py-0.5 text-sm ${
                    picked.includes(t.name) ? "bg-blue-600 text-white" : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                  }`}
                >
                  {t.name}
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm(`Remove the theme "${t.name}"?`) && remove("deleteTheme", t.id)}
                  aria-label={`Remove ${t.name}`}
                  className="rounded-r-full bg-white px-1.5 py-0.5 text-xs text-neutral-400 ring-1 ring-neutral-200 hover:text-red-600"
                >
                  ✕
                </button>
              </span>
            ))}
            {themes.length === 0 && <span className="text-xs text-neutral-400">No saved themes yet.</span>}
          </div>
          <div className="flex gap-2">
            <input
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTheme()}
              placeholder="New theme: space, pirates, fall..."
              maxLength={60}
              className={`${input} min-w-0 flex-1`}
            />
            <button type="button" onClick={addTheme} className="rounded border border-neutral-300 px-3 py-1 text-sm">
              Add
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-neutral-500">
            Kids
            <input type="number" min={1} max={200} value={kids} onChange={(e) => setKids(e.target.value)} className={`${input} w-20`} />
          </label>
          <label className="flex flex-col text-xs text-neutral-500">
            Age
            <input
              type="number"
              min={AGES.min}
              max={AGES.max}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={`${input} w-20`}
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Writing your packet (about a minute)..." : "Make packet"}
          </button>
          {madeId && (
            <a href={`/wolffie/${madeId}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 underline">
              Open your packet
            </a>
          )}
        </div>
      </div>

      {packets.length > 0 && (
        <ul className="flex flex-col gap-1">
          {packets.map((p) => (
            <li key={p.id} className="flex items-center gap-3 text-sm">
              <a href={`/wolffie/${p.id}`} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">
                {p.title}
              </a>
              <span className="text-xs text-neutral-500">
                {p.themes.join(", ")} · {p.kids} kids · age {p.age} · {new Date(p.createdAt).toLocaleDateString()}
              </span>
              <button
                type="button"
                onClick={() => window.confirm("Delete this packet?") && remove("deletePacket", p.id)}
                aria-label="Delete packet"
                className="ml-auto text-neutral-400 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
