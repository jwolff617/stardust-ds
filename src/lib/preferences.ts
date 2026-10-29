// How someone has arranged the app, saved to their account (profiles.
// preferences) with a copy in the browser. The browser copy loads first so
// the page opens arranged; the account copy wins once it arrives. Pure,
// safe to import from client and server.

export type PartOfSpeech = "verb" | "noun" | "more";

// Night DS: which list, filters, and sort were showing last time.
export type NightView = {
  state?: "active" | "archived" | "done";
  timeFrames?: string[];
  labels?: string[];
  sort?: string;
};

export type Preferences = {
  module2?: {
    deselectedIds?: string[];
    activeTabs?: PartOfSpeech[];
    viewMode?: "term" | "display";
    // Dictionary ids, top of the feed first.
    order?: string[];
    // On phones, the dictionary list folds away so the feed gets the width.
    listCollapsed?: boolean;
    night?: NightView;
  };
  module1?: { storeHidden?: boolean; collapsed?: boolean };
  module3?: { collapsed?: boolean };
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
  const m3 = r.module3 ?? {};
  const flag = (v: unknown) => (typeof v === "boolean" ? v : undefined);
  const night = (m2.night && typeof m2.night === "object" ? m2.night : {}) as Record<string, unknown>;
  const tabs = strings(m2.activeTabs)?.filter((t): t is PartOfSpeech => ["verb", "noun", "more"].includes(t));
  return {
    module2: {
      deselectedIds: strings(m2.deselectedIds),
      activeTabs: tabs,
      viewMode: m2.viewMode === "term" || m2.viewMode === "display" ? m2.viewMode : undefined,
      order: strings(m2.order),
      listCollapsed: flag(m2.listCollapsed),
      night: {
        state: night.state === "active" || night.state === "archived" || night.state === "done" ? night.state : undefined,
        timeFrames: strings(night.timeFrames, 10),
        labels: strings(night.labels, 20),
        sort: typeof night.sort === "string" ? night.sort.slice(0, 20) : undefined,
      },
    },
    module1: { storeHidden: flag(m1.storeHidden), collapsed: flag(m1.collapsed) },
    module3: { collapsed: flag(m3.collapsed) },
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
