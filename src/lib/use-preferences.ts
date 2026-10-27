"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadBrowserPreferences, saveBrowserPreferences, type Preferences } from "./preferences";

// The arrangement Module 1 and Module 2 share. Starts empty so the server
// and browser render the same first frame, then fills from the browser
// copy, then from the account. Changes save to both; the account save
// waits a moment so a burst of clicks is one write.
export function usePreferences(isLoggedIn: boolean) {
  const [prefs, setPrefs] = useState<Preferences>({});
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const local = loadBrowserPreferences();
    const fromAccount = isLoggedIn
      ? fetch("/api/preferences")
          .then((res) => res.json())
          .then((data) => (data.preferences as Preferences | null) ?? null)
          .catch(() => null)
      : Promise.resolve(null);
    fromAccount.then((account) => {
      if (cancelled) return;
      setPrefs(account ?? local);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const update = useCallback(
    (change: (prev: Preferences) => Preferences) => {
      setPrefs((prev) => {
        const next = change(prev);
        saveBrowserPreferences(next);
        if (isLoggedIn) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            fetch("/api/preferences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ preferences: next }),
            }).catch(() => {});
          }, 800);
        }
        return next;
      });
    },
    [isLoggedIn],
  );

  return { prefs, loaded, update };
}
