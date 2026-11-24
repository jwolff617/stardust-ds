"use client";

import { Spark } from "./Spark";
import { DictionaryView, type MyDictionary } from "./DictionaryView";
import { Settings } from "./Settings";
import { InboxView } from "./InboxView";
import { ProfileView } from "./ProfileView";
import { ProfileFields } from "./ProfileFields";
import { NewNotebook } from "./NewNotebook";
import { ReportsQueue } from "./ReportsQueue";
import { TypePill } from "./StardustParts";
import { OfficialQueue, Organizations } from "./Organizations";
import type { FoundWord, WordFields } from "@/lib/sage-ui";
import type { MyNoun } from "@/lib/shortcuts";
import { MyNounsView } from "./MyNouns";

// What the rectangle holds right now.
export type Box =
  | { mode: "spark" }
  | { mode: "search" }
  | { mode: "word" }
  | { mode: "results"; items: FoundWord[]; title?: string }
  | { mode: "view"; dictionary: MyDictionary }
  | { mode: "panel"; panel: "settings" | "organizations" | "new-notebook" | "reports" | "inbox" | "profile" | "nouns"; section?: string };

// The big display: the body, search results, or a thing working (a
// notebook, profile, inbox, settings...).
export function StardustDisplay({
  box,
  body,
  setBody,
  onFormKey,
  isLoggedIn,
  reloadKey,
  privateProfileId,
  publicProfileId,
  onOpen,
  onChanged,
  onClose,
  nouns = [],
  onOpenNoun = () => {},
  onStarNoun = () => {},
}: {
  box: Box;
  body: string;
  setBody: (b: string) => void;
  onFormKey: (e: React.KeyboardEvent) => void;
  isLoggedIn: boolean;
  reloadKey: number;
  privateProfileId: string | null;
  publicProfileId: string | null;
  onOpen: (w: { word: string; body: string; kind?: string; id?: string } & WordFields) => void;
  onChanged: () => void;
  onClose: () => void;
  // My Nouns: everything of yours.
  nouns?: MyNoun[];
  onOpenNoun?: (n: MyNoun) => void;
  onStarNoun?: (n: MyNoun) => void;
}) {
  switch (box.mode) {
    case "spark":
      return <Spark />;
    case "search":
    case "word":
      if (box.mode === "word" && !isLoggedIn) return <div className="whitespace-pre-wrap pr-6 text-base leading-relaxed">{body}</div>;
      return (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          // In the body, Enter is a new line. Only Ctrl+Enter acts (search or save).
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onFormKey(e);
          }}
          placeholder={box.mode === "word" ? "Write its meaning here." : isLoggedIn ? "" : "Search public words. Log in to write your own."}
          id="body"
          aria-label="Body"
          className="min-h-[40vh] w-full flex-1 resize-none pr-6 text-base leading-relaxed outline-none placeholder:opacity-30"
        />
      );
    case "results":
      return box.items.length === 0 ? (
        <p className="text-[var(--muted)]">{box.title ? `No ${box.title.replace(/^Your /, "")} yet. Write a word and press Create.` : "Nothing found. Try fewer words, or a wider time."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line)] pr-6">
          {box.title && <li className="pb-2 text-xs font-medium text-[var(--muted)]">{box.title}</li>}
          {box.items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button type="button" onClick={() => onOpen(item)} className="flex w-full flex-col gap-1 py-3 text-left hover:opacity-70">
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold">{item.word}</span>
                  <TypePill type={item.kind} />
                </span>
                <span className="line-clamp-2 text-sm text-[var(--muted)]">{item.body}</span>
                <span className="text-xs opacity-50">
                  {[item.details, item.place, item.people, item.time, item.visibility].filter(Boolean).join(" · ")}
                </span>
                {item.shared && item.shared.length > 0 && (
                  <span className="text-xs opacity-70">Shares: {item.shared.slice(0, 8).join(", ")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      );
    case "view":
      return (
        <div className="light-card -m-2 rounded p-2 pr-8 sm:-m-3 sm:p-3 sm:pr-8">
          <DictionaryView d={box.dictionary} reloadKey={reloadKey} />
        </div>
      );
    case "panel":
      switch (box.panel) {
        case "settings":
          return <Settings isLoggedIn={isLoggedIn} privateProfileId={privateProfileId} />;
        case "inbox":
          return <InboxView reloadKey={reloadKey} />;
        case "nouns":
          return <MyNounsView nouns={nouns} onOpen={onOpenNoun} onStar={onStarNoun} />;
        case "profile":
          return (
            <div className="light-card -m-2 flex flex-col gap-8 rounded p-2 pr-8">
              {publicProfileId && !box.section && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold tracking-[0.2em] text-neutral-900">ABOUT ME</h3>
                  <ProfileFields dictionaries={[{ id: publicProfileId, name: "Profile" }]} reloadKey={reloadKey} />
                </div>
              )}
              <ProfileView key={box.section ?? "all"} reloadKey={reloadKey} section={box.section} />
            </div>
          );
        case "organizations":
          return (
            <div className="light-card -m-2 rounded p-2 pr-8">
              <Organizations onClose={onClose} />
            </div>
          );
        case "new-notebook":
          return (
            <div className="light-card -m-2 rounded p-2 pr-8">
              <NewNotebook
                onDone={() => {
                  onChanged();
                  onClose();
                }}
                onClose={onClose}
              />
            </div>
          );
        case "reports":
          return (
            <div className="light-card -m-2 flex flex-col gap-6 rounded p-2 pr-8">
              <ReportsQueue />
              <OfficialQueue />
            </div>
          );
      }
  }
}
