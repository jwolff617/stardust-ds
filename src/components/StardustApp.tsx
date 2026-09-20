"use client";

import { useState } from "react";
import { Module1DictionarySelect, type SelectedDictionary } from "./Module1DictionarySelect";
import { Module2Definitions } from "./Module2Definitions";
import { Module3SageAI } from "./Module3SageAI";

export function StardustApp({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [selectedDictionaries, setSelectedDictionaries] = useState<SelectedDictionary[]>([]);

  return (
    <div className="flex flex-1 flex-col">
      <Module1DictionarySelect
        isLoggedIn={isLoggedIn}
        onSelectionChange={setSelectedDictionaries}
      />
      <Module2Definitions dictionaries={selectedDictionaries} />
      <Module3SageAI isLoggedIn={isLoggedIn} />
    </div>
  );
}
