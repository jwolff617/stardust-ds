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
  layout?: "lines" | "cards";
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
  // Hotkeys 1 to 9: a number Sage reads as a noun. "4. new entry ..."
  // writes to whatever 4 points at.
  hotkeys?: Record<string, Hotkey>;
};

export type Hotkey = {
  // What the number means, in the spark's own words ("Playbound City journal").
  meaning: string;
  // The dictionary it points at, when it's one of theirs.
  dictionaryId?: string;
};

// 1 to 9 are each spark's own. Past 9, the # box takes tickers.
export const HOTKEY_NUMBERS = Array.from({ length: 9 }, (_, i) => String(i + 1));

function cleanHotkeys(raw: unknown): Record<string, Hotkey> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, Hotkey> = {};
  for (const n of HOTKEY_NUMBERS) {
    const h = (raw as Record<string, unknown>)[n] as Record<string, unknown> | undefined;
    if (!h || typeof h !== "object") continue;
    const meaning = typeof h.meaning === "string" ? h.meaning.trim().slice(0, 120) : "";
    const dictionaryId = typeof h.dictionaryId === "string" && /^[0-9a-f-]{36}$/i.test(h.dictionaryId) ? h.dictionaryId : undefined;
    if (meaning || dictionaryId) out[n] = { meaning, dictionaryId };
  }
  return out;
}

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
        layout: night.layout === "lines" || night.layout === "cards" ? night.layout : undefined,
      },
    },
    module1: { storeHidden: flag(m1.storeHidden), collapsed: flag(m1.collapsed) },
    module3: { collapsed: flag(m3.collapsed) },
    hotkeys: cleanHotkeys((r as Record<string, unknown>).hotkeys),
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
