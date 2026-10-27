"use client";

import { useCallback, useState } from "react";
import { Module1DictionarySelect, type SelectedDictionary } from "./Module1DictionarySelect";
import { Module2Definitions } from "./Module2Definitions";
import { Module3SageAI } from "./Module3SageAI";

export function StardustApp({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [selectedDictionaries, setSelectedDictionaries] = useState<SelectedDictionary[]>([]);
  // Bumped after any change (a Sage AI reply, a dictionary toggle, the
  // Refresh button) so every module refetches what it shows.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex flex-1 flex-col">
      <Module1DictionarySelect
        isLoggedIn={isLoggedIn}
        onSelectionChange={setSelectedDictionaries}
        reloadKey={reloadKey}
        onChange={reload}
      />
      <Module2Definitions dictionaries={selectedDictionaries} reloadKey={reloadKey} onRefresh={reload} />
      <Module3SageAI isLoggedIn={isLoggedIn} onChange={reload} />
    </div>
  );
}
