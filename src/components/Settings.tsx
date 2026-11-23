"use client";

import { useState } from "react";
import { ProfileFields } from "./ProfileFields";
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
export function Settings({
  isLoggedIn,
  privateProfileId,
}: {
  isLoggedIn: boolean;
  privateProfileId: string | null;
}) {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "device" : readTheme()));
  const { prefs, loaded, update } = usePreferences(isLoggedIn);
  const hotkeys = prefs.hotkeys ?? {};

  function setHotkey(n: string, change: Partial<Hotkey>) {
    update((p) => {
      const next = { ...(p.hotkeys ?? {}) };
      const merged: Hotkey = { ...next[n], ...change, meaning: change.meaning ?? next[n]?.meaning ?? "" };
      delete merged.dictionaryId;
      if (!merged.meaning.trim()) delete next[n];
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

      {privateProfileId && (
        <div>
          <h2 className="mb-1 text-sm font-semibold tracking-[0.25em]">PRIVATE</h2>
          <p className="mb-3 text-sm opacity-70">Only you see these: your name, email, birthday, anything else.</p>
          <div className="light-card rounded p-2">
            <ProfileFields dictionaries={[{ id: privateProfileId, name: "Private" }]} />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-1 text-sm font-semibold tracking-[0.25em]">HOTKEYS</h2>
        <p className="mb-4 text-sm opacity-70">
          Give a number one of your words: a journal, a group, an organization, an idea. Then &ldquo;4. new entry ...&rdquo; goes straight there.
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
                <li key={n} className="grid grid-cols-[2rem_1fr] items-center gap-2">
                  <span className="text-xl font-semibold">{n}</span>
                  <input
                    value={h?.meaning ?? ""}
                    onChange={(e) => setHotkey(n, { meaning: e.target.value })}
                    placeholder="A word of yours, like: Playbound City"
                    aria-label={`Hotkey ${n} meaning`}
                    className="min-w-0 border-b border-[var(--line)] py-1 outline-none placeholder:opacity-30"
                  />
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
