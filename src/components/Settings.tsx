"use client";

import { useEffect, useState } from "react";
import { ProfileFields } from "./ProfileFields";
import { getDisplayName, setDisplayName } from "@/app/actions/words";
import { HOTKEY_NUMBERS, type Hotkey } from "@/lib/preferences";
import { usePreferences } from "@/lib/use-preferences";

type Theme = "light" | "dark" | "device";

function readTheme(): Theme {
  try {
    const t = window.localStorage.getItem("stardust.theme");
    return t === "dark" || t === "device" ? t : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  try {
    if (theme === "light") {
      window.localStorage.removeItem("stardust.theme");
      delete document.documentElement.dataset.theme;
    } else {
      window.localStorage.setItem("stardust.theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    if (theme !== "light") document.documentElement.dataset.theme = theme;
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
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "light" : readTheme()));
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
        <h2 className="mb-3 text-sm font-semibold">Screen</h2>
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

      {isLoggedIn && <NameSetting />}

      {privateProfileId && (
        <div>
          <h2 className="mb-1 text-sm font-semibold">Private</h2>
          <p className="mb-3 text-sm opacity-70">Only you see these: your name, email, birthday, anything else.</p>
          <div className="light-card rounded p-2">
            <ProfileFields dictionaries={[{ id: privateProfileId, name: "Private" }]} />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-1 text-sm font-semibold">Hotkeys</h2>
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

// Your name: what other sparks see on your words and messages.
function NameSetting() {
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    getDisplayName()
      .then((n) => {
        setName(n);
        setSaved(n);
      })
      .catch(() => setName(""));
  }, []);

  if (name === null) return null;
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">Your name</h2>
      <p className="mb-3 text-sm opacity-70">What other sparks see on your words, groups, and messages. Shows under STARDUST.</p>
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await setDisplayName(name);
            setSaved(name.trim());
            setNote("Saved. It shows under STARDUST next time the page loads.");
          } catch (err) {
            setNote((err as Error).message);
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNote("");
          }}
          maxLength={60}
          aria-label="Your name"
          className="min-w-0 flex-1 border-b border-[var(--line)] py-1 outline-none"
        />
        {name.trim() !== saved && (
          <button type="submit" className="rounded-full border border-[var(--foreground)] px-4 py-0.5 text-sm">
            Save
          </button>
        )}
      </form>
      {note && <p className="mt-1 text-xs opacity-70">{note}</p>}
    </div>
  );
}
