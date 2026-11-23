"use client";

import { useState, type ReactNode } from "react";
import { GroupMembers } from "./GroupMembers";
import { ProfileFields } from "./ProfileFields";
import { ProfileView } from "./ProfileView";
import { NightNotes } from "./NightNotes";
import { AfterSchoolView } from "./AfterSchoolView";
import { CustomView } from "./CustomView";
import { BasicsView } from "./BasicsView";
import { JournalView } from "./JournalView";
import { basicApp } from "@/lib/basics";
import type { NightView } from "@/lib/preferences";

export type Belongs = "personal" | "group" | "public";

// One of the signed-in spark's dictionaries, as the page shows it.
export type MyDictionary = { id: string; name: string; displayKind: string; belongs: Belongs };

// A shared notebook shows who's in it above the notes: the owner adds
// people by email (up to 30) and anyone can leave.
function SharedWith({ d, reloadKey, children }: { d: MyDictionary; reloadKey: number; children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  if (d.belongs !== "group") return <>{children}</>;
  return (
    <div className="flex flex-col gap-3">
      <GroupMembers dictionaryId={d.id} reloadKey={reloadKey} onError={setError} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {children}
    </div>
  );
}

// A dictionary's own view (Notes, a journal, Birthdays...), opened
// in the rectangle when Sage AI is asked for it.
export function DictionaryView({ d, reloadKey }: { d: MyDictionary; reloadKey: number }) {
  const [night, setNight] = useState<NightView>({});
  const dictionary = { id: d.id, name: d.name };
  switch (d.displayKind) {
    case "notes_list":
      return (
        <SharedWith d={d} reloadKey={reloadKey}>
          <NightNotes dictionaries={[dictionary]} reloadKey={reloadKey} view={night} onViewChange={setNight} />
        </SharedWith>
      );
    case "profile":
      // Your public lines, then what you offer and seek.
      return (
        <div className="flex flex-col gap-8">
          <ProfileFields dictionaries={[dictionary]} reloadKey={reloadKey} />
          <ProfileView reloadKey={reloadKey} />
        </div>
      );
    case "after_school":
      return <AfterSchoolView dictionary={dictionary} reloadKey={reloadKey} />;
    case "journal":
      return (
        <SharedWith d={d} reloadKey={reloadKey}>
          <JournalView dictionary={dictionary} reloadKey={reloadKey} />
        </SharedWith>
      );
    case "custom":
      return <CustomView dictionary={dictionary} reloadKey={reloadKey} />;
    default: {
      const app = basicApp(d.displayKind);
      return app ? (
        <BasicsView app={app} dictionary={dictionary} reloadKey={reloadKey} />
      ) : (
        <p className="text-sm opacity-60">{d.name} has no view of its own. Ask Sage to find its words.</p>
      );
    }
  }
}
