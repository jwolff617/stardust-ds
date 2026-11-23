"use client";

import { useState } from "react";
import type { MyDictionary } from "./DictionaryView";
import { HOTKEY_NUMBERS, type Hotkey } from "@/lib/preferences";
import { usePreferences } from "@/lib/use-preferences";

type Theme = "light" | "dark" | "device";

function readTheme(): Theme {
  try {
    const t = window.localStorage.getItem("stardust.theme");
    return t === "light" || t === "dark" ? t : "device";
  } catch {
    return "device";
  }
}

function applyTheme(theme: Theme) {
  try {
    if (theme === "device") {
      window.localStorage.removeItem("stardust.theme");
      delete document.documentElement.dataset.theme;
    } else {
      window.localStorage.setItem("stardust.theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    if (theme !== "device") document.documentElement.dataset.theme = theme;
  }
}

// Opened by typing "settings" to Sage. Light or dark, and hotkeys 1 to 9.
export function Settings({ dictionaries, isLoggedIn }: { dictionaries: MyDictionary[]; isLoggedIn: boolean }) {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "device" : readTheme()));
  const { prefs, loaded, update } = usePreferences(isLoggedIn);
  const hotkeys = prefs.hotkeys ?? {};

  function setHotkey(n: string, change: Partial<Hotkey>) {
    update((p) => {
      const next = { ...(p.hotkeys ?? {}) };
      const merged: Hotkey = { ...next[n], ...change, meaning: change.meaning ?? next[n]?.meaning ?? "" };
      if (!merged.meaning.trim() && !merged.dictionaryId) delete next[n];
      else next[n] = merged;
      return { ...p, hotkeys: next };
    });
  }

  return (
    <div className="flex flex-col gap-8 pr-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-[0.25em]">SCREEN</h2>
        <div className="flex gap-2">
          {(["light", "dark", "device"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTheme(t);
                applyTheme(t);
              }}
              aria-pressed={theme === t}
              className={`rounded-full border px-4 py-1 text-sm ${theme === t ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--line)]"}`}
            >
              {t === "light" ? "White" : t === "dark" ? "Black" : "Match my device"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold tracking-[0.25em]">HOTKEYS</h2>
        <p className="mb-4 text-sm opacity-70">
          Give a number a meaning. Then tell Sage &ldquo;4. new entry&rdquo; and it writes to whatever 4 means.
        </p>
        {!isLoggedIn ? (
          <p className="text-sm opacity-60">Log in to set hotkeys.</p>
        ) : !loaded ? (
          <p className="text-sm opacity-60">Loading...</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {HOTKEY_NUMBERS.map((n) => {
              const h = hotkeys[n];
              return (
                <li key={n} className="grid grid-cols-[2rem_1fr] items-center gap-2 sm:grid-cols-[2rem_1fr_16rem]">
                  <span className="text-xl font-semibold">{n}</span>
                  <input
                    value={h?.meaning ?? ""}
                    onChange={(e) => setHotkey(n, { meaning: e.target.value })}
                    placeholder="What it means, like: Playbound City journal"
                    aria-label={`Hotkey ${n} meaning`}
                    className="min-w-0 border-b border-[var(--line)] py-1 outline-none placeholder:opacity-30"
                  />
                  <select
                    value={h?.dictionaryId ?? ""}
                    onChange={(e) => setHotkey(n, { dictionaryId: e.target.value || undefined })}
                    aria-label={`Hotkey ${n} dictionary`}
                    className="col-start-2 border-b border-[var(--line)] bg-[var(--background)] py-1 text-sm sm:col-start-auto"
                  >
                    <option value="">Any (Sage works it out)</option>
                    {dictionaries.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.belongs === "personal" ? "private" : d.belongs})
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
