"use client";

import { useCallback, useState } from "react";
import { Module1DictionarySelect, type SelectedDictionary } from "./Module1DictionarySelect";
import { Module2Definitions } from "./Module2Definitions";
import { Module3SageAI } from "./Module3SageAI";
import { usePreferences } from "@/lib/use-preferences";

// The starting prompt for building a dictionary with Sage AI. The person
// finishes the sentence.
const CREATE_PROMPT = "Help me build my own dictionary. Ask me a few questions, suggest the fewest fields that would work, and build it once I say yes. Here's what I need it for: ";

export function StardustApp({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [selectedDictionaries, setSelectedDictionaries] = useState<SelectedDictionary[]>([]);
  // Bumped after any change (a Sage AI reply, a dictionary toggle, the
  // Refresh button) so every module refetches what it shows.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const { prefs, loaded, update } = usePreferences(isLoggedIn);
  // A message to start Sage AI with; n changes so the same text can be sent twice.
  const [sageDraft, setSageDraft] = useState<{ text: string; n: number } | null>(null);

  return (
    // Bottom padding keeps the end of the feed clear of the Sage AI button.
    <div className="flex flex-1 flex-col pb-20">
      <Module1DictionarySelect
        isLoggedIn={isLoggedIn}
        onSelectionChange={setSelectedDictionaries}
        reloadKey={reloadKey}
        onChange={reload}
        storeHidden={prefs.module1?.storeHidden ?? false}
        onStoreHiddenChange={(hidden) => update((p) => ({ ...p, module1: { ...p.module1, storeHidden: hidden } }))}
        collapsed={prefs.module1?.collapsed ?? false}
        onCollapsedChange={(collapsed) => update((p) => ({ ...p, module1: { ...p.module1, collapsed } }))}
        onCreateOwn={() => {
          update((p) => ({ ...p, module3: { collapsed: false } }));
          setSageDraft((d) => ({ text: CREATE_PROMPT, n: (d?.n ?? 0) + 1 }));
        }}
      />
      {loaded && (
        <Module2Definitions
          dictionaries={selectedDictionaries}
          reloadKey={reloadKey}
          onRefresh={reload}
          prefs={prefs.module2 ?? {}}
          onPrefsChange={(change) => update((p) => ({ ...p, module2: change(p.module2 ?? {}) }))}
        />
      )}
      {loaded && (
        <Module3SageAI
          isLoggedIn={isLoggedIn}
          onChange={reload}
          collapsed={prefs.module3?.collapsed ?? false}
          onCollapsedChange={(collapsed) => update((p) => ({ ...p, module3: { collapsed } }))}
          draft={sageDraft}
        />
      )}
    </div>
  );
}
