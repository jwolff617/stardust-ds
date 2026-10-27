// How someone has arranged the app, saved to their account (profiles.
// preferences) with a copy in the browser. The browser copy loads first so
// the page opens arranged; the account copy wins once it arrives. Pure,
// safe to import from client and server.

export type PartOfSpeech = "verb" | "noun" | "more";

export type Preferences = {
  module2?: {
    deselectedIds?: string[];
    activeTabs?: PartOfSpeech[];
    viewMode?: "term" | "display";
    // Dictionary ids, top of the feed first.
    order?: string[];
  };
  module1?: { storeHidden?: boolean };
};

const BROWSER_KEY = "stardust.preferences";

function strings(value: unknown, max = 500): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, max) : undefined;
}

// Keeps only the known fields, so nothing else gets stored.
export function cleanPreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const m2 = r.module2 ?? {};
  const m1 = r.module1 ?? {};
  const tabs = strings(m2.activeTabs)?.filter((t): t is PartOfSpeech => ["verb", "noun", "more"].includes(t));
  return {
    module2: {
      deselectedIds: strings(m2.deselectedIds),
      activeTabs: tabs,
      viewMode: m2.viewMode === "term" || m2.viewMode === "display" ? m2.viewMode : undefined,
      order: strings(m2.order),
    },
    module1: { storeHidden: typeof m1.storeHidden === "boolean" ? m1.storeHidden : undefined },
  };
}

export function loadBrowserPreferences(): Preferences {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(BROWSER_KEY);
    if (saved) return cleanPreferences(JSON.parse(saved));
    // Module 2's settings from before they moved here.
    const older = window.localStorage.getItem("stardust.module2");
    return cleanPreferences(older ? { module2: JSON.parse(older) } : {});
  } catch {
    return {};
  }
}

export function saveBrowserPreferences(prefs: Preferences) {
  try {
    window.localStorage.setItem(BROWSER_KEY, JSON.stringify(prefs));
  } catch {
    // Private windows can refuse storage; the account copy still saves.
  }
}
