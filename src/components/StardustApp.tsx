"use client";

import { useCallback, useState } from "react";
import { Module1DictionarySelect, type SelectedDictionary } from "./Module1DictionarySelect";
import { Module2Definitions } from "./Module2Definitions";
import { Module3SageAI } from "./Module3SageAI";
import { usePreferences } from "@/lib/use-preferences";

export function StardustApp({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [selectedDictionaries, setSelectedDictionaries] = useState<SelectedDictionary[]>([]);
  // Bumped after any change (a Sage AI reply, a dictionary toggle, the
  // Refresh button) so every module refetches what it shows.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const { prefs, loaded, update } = usePreferences(isLoggedIn);

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
        />
      )}
    </div>
  );
}
