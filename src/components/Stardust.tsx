"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DictionaryPopup } from "./DictionaryPopup";
import { DictionaryView, type Belongs, type MyDictionary } from "./DictionaryView";
import { NewNotebook } from "./NewNotebook";
import { OfficialQueue, Organizations } from "./Organizations";
import { ReportsQueue } from "./ReportsQueue";
import { Settings } from "./Settings";
import { Spark } from "./Spark";
import { signOut } from "@/app/login/actions";
import { createWord, saveWord as saveWordAction, type WordType } from "@/app/actions/words";
import { InboxView } from "./InboxView";
import { OrgPosts } from "./OrgPosts";
import { visibilityOf } from "@/lib/visibility";
import { ProfileView } from "./ProfileView";
import { ProfileFields } from "./ProfileFields";
import { splitStream, type FoundWord, type UiDirective, type WordFields } from "@/lib/sage-ui";

type Fields = Required<WordFields>;
const EMPTY_FIELDS: Fields = { place: "", people: "", time: "", visibility: "" };
const FIELD_NAMES: { key: keyof Fields; label: string }[] = [
  { key: "place", label: "Place" },
  { key: "people", label: "People" },
  { key: "time", label: "Time" },
  { key: "visibility", label: "Visibility" },
];

// What the rectangle holds right now.
type Box =
  | { mode: "spark" }
  | { mode: "search" }
  | { mode: "word" }
  | { mode: "results"; items: FoundWord[]; title?: string }
  | { mode: "view"; dictionary: MyDictionary }
  | { mode: "panel"; panel: "settings" | "organizations" | "new-notebook" | "reports" | "inbox" | "profile"; section?: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: { length: number; [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechCtor(): (new () => SpeechRecognitionLike) | undefined {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

// Same word, ignoring case, spaces, and a leading "The".
function sameWord(a: string, b: string) {
  const n = (t: string) => t.trim().toLowerCase().replace(/^the\s+/, "").replace(/\s+/g, " ");
  return n(a) === n(b);
}

// "Peacemaker's Notes" is stored with the owner's name; on your own page
// it's just "Notes".
function shortName(name: string): string {
  return name.replace(/^.{1,40}?['’]s\s+/, "") || name;
}

type DictionaryResult = {
  id: string;
  address: string;
  name: string;
  scope: string;
  optedIn: boolean;
  displayKind: string;
  instance: { id: string; name: string; displayKind: string } | null;
};

function belongsOf(scope: string): Belongs {
  return scope === "personal" ? "personal" : scope === "group" ? "group" : "public";
}

export function Stardust({ isLoggedIn, userName }: { isLoggedIn: boolean; userName: string | null; isModerator?: boolean }) {
  const [word, setWord] = useState("");
  const [body, setBody] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [box, setBox] = useState<Box>(isLoggedIn ? { mode: "search" } : { mode: "spark" });
  const [dictionaries, setDictionaries] = useState<MyDictionary[]>([]);
  // The private profile lives behind Settings, not in the list.
  const [privateProfileId, setPrivateProfileId] = useState<string | null>(null);
  const publicProfile = dictionaries.find((d) => d.displayKind === "profile") ?? null;
  const [reloadKey, setReloadKey] = useState(0);
  const [popup, setPopup] = useState<"closed" | "open" | "minimized">("closed");
  const [wordList, setWordList] = useState<{ exists: boolean; words: ListWord[] }>({ exists: false, words: [] });

  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const conversationRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSpeech = useSyncExternalStore(noopSubscribe, () => Boolean(speechCtor()), () => false);

  // What the open word is, when it came from a search: Sage edits it by id.
  const [ref, setRef] = useState<{ kind: string; id: string } | null>(null);
  // An org's own line: its type, website, Official.
  const [orgInfo, setOrgInfo] = useState<{ kind: string; website: string; official: boolean; applied: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  // The search form is always typeable. A word is typeable when signed in:
  // the rectangle is where its meaning gets written.
  const searching = box.mode === "search";
  // Renaming a word is rare: it takes the Edit button.
  const [renaming, setRenaming] = useState(false);
  // Create: what kind of word this is, and that kind's own details.
  const [newType, setNewType] = useState<WordType>("noun");
  const [newDetails, setNewDetails] = useState<Record<string, string>>({});

  // The spark's dictionaries, for views and hotkeys.
  const fetchDictionaries = useCallback(async () => {
    if (!isLoggedIn) return { mine: [] as MyDictionary[], privateId: null as string | null };
    const res = await fetch("/api/dictionaries/search?q=");
    const data = await res.json();
    const all = (data.dictionaries ?? []) as DictionaryResult[];
    const priv = all.find((d) => d.address === "private-profile");
    const mine: MyDictionary[] = all
      .filter((d) => d.optedIn && d.address !== "private-profile")
      .map((d) =>
        d.instance
          ? { id: d.instance.id, name: shortName(d.instance.name), displayKind: d.instance.displayKind, belongs: belongsOf(d.scope) }
          : { id: d.id, name: d.name, displayKind: d.displayKind, belongs: belongsOf(d.scope) },
      );
    return { mine, privateId: priv?.instance?.id ?? null };
  }, [isLoggedIn]);

  const loadDictionaries = useCallback(async () => {
    const { mine, privateId } = await fetchDictionaries();
    setDictionaries(mine);
    setPrivateProfileId(privateId);
    return mine;
  }, [fetchDictionaries]);

  const flushSaveRef = useRef<(() => void) | null>(null);
  const openWordRef = useRef<((kind: string, id: string) => Promise<boolean>) | null>(null);
  const loadWordList = useCallback(async () => {
    if (!isLoggedIn) return;
    const res = await fetch("/api/word-list");
    const data = await res.json();
    setWordList({ exists: Boolean(data.exists), words: data.words ?? [] });
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/word-list")
      .then((r) => r.json())
      .then((data) => setWordList({ exists: Boolean(data.exists), words: data.words ?? [] }))
      .catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => {
    fetchDictionaries()
      .then(({ mine, privateId }) => {
        setDictionaries(mine);
        setPrivateProfileId(privateId);
      })
      .catch(() => {});
  }, [fetchDictionaries]);

  // Clear steps back: from a word you opened out of search, to those
  // results; from the results (or anything else), to an empty page.
  const lastResults = useRef<{ items: FoundWord[]; word: string; body: string; fields: Fields } | null>(null);
  function clearStep() {
    const back = lastResults.current;
    if (back && box.mode !== "results" && box.mode !== "search") {
      setRenaming(false);
      setRef(null);
      setDirty(false);
      setWord(back.word);
      setBody(back.body);
      setFields(back.fields);
      setBox({ mode: "results", items: back.items });
      return;
    }
    lastResults.current = null;
    clearToSearch();
  }

  function clearToSearch() {
    flushSaveRef.current?.();
    setRenaming(false);
    setRef(null);
    setDirty(false);
    setWord("");
    setBody("");
    setFields(EMPTY_FIELDS);
    setBox({ mode: "search" });
  }

  // keep: Sage refreshing the word that's open; if it didn't say which
  // one, it's still the same word, so it stays editable.
  function showWord(w: { word: string; body: string; kind?: string; id?: string } & WordFields, keep = false) {
    // Opening another word: save the one you were on first.
    if (!keep) flushSaveRef.current?.();
    setRenaming(false);
    if (w.kind !== "organization") setOrgInfo(null);
    setSaveState("");
    setRef((prev) => (w.kind && w.id ? { kind: w.kind, id: w.id } : keep ? prev : null));
    setDirty(false);
    setWord(w.word);
    setBody(w.body);
    setFields({
      place: w.place ?? "",
      people: w.people ?? "",
      time: w.time ?? "",
      visibility: w.visibility ?? "",
    });
    setBox({ mode: "word" });
  }

  const applyDirective = useCallback(
    async (d: UiDirective) => {
      switch (d.type) {
        case "word":
          showWord(d, true);
          break;
        case "results":
          setWord(d.query.word ?? "");
          setBody(d.query.body ?? "");
          setFields({
            place: d.query.place ?? "",
            people: d.query.people ?? "",
            time: d.query.time ?? "",
            visibility: d.query.visibility ?? "",
          });
          lastResults.current = {
            items: d.items,
            word: d.query.word ?? "",
            body: d.query.body ?? "",
            fields: { place: d.query.place ?? "", people: d.query.people ?? "", time: d.query.time ?? "", visibility: d.query.visibility ?? "" },
          };
          setBox({ mode: "results", items: d.items, title: d.title });
          // "Your journals": Create makes another one.
          if (d.thing) setNewType(d.thing as WordType);
          break;
        case "view": {
          let match = dictionaries.find((x) => x.id === d.id);
          // Sage may have just turned it on.
          if (!match) match = (await loadDictionaries()).find((x) => x.id === d.id);
          setWord(d.name);
          setBody("");
          setFields(EMPTY_FIELDS);
          setBox(match ? { mode: "view", dictionary: match } : { mode: "search" });
          break;
        }
        case "panel":
          setWord(PANEL_TITLES[d.panel]);
          setBody("");
          setFields(EMPTY_FIELDS);
          setBox({ mode: "panel", panel: d.panel, section: d.section });
          break;
        case "clear":
          clearToSearch();
          break;
        case "word-list":
          await loadWordList();
          break;
        case "open":
          await openWordRef.current?.(d.kind, d.id);
          break;
      }
    },
    [dictionaries, loadDictionaries, loadWordList],
  );

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // "settings" opens settings without a trip to Sage.
    if (/^settings\.?$/i.test(trimmed)) {
      setInput("");
      applyDirective({ type: "panel", panel: "settings" });
      return;
    }

    if (!isLoggedIn) {
      setReply("Log in to talk to Sage.");
      return;
    }

    setInput("");
    setReply("");
    setSending(true);
    try {
      const res = await fetch("/api/sage-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId: conversationRef.current,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // What's on the page, so "edit this" and "match it" make sense.
          onPage:
            box.mode === "word" || box.mode === "results"
              ? { word, body: body.slice(0, 50000), ...fields, ...(ref ? { kind: ref.kind, id: ref.id } : {}), status: dirty ? "changed, not saved" : "saved" }
              : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReply(data.error ?? "Something went wrong.");
        return;
      }
      conversationRef.current = res.headers.get("X-Conversation-Id") ?? conversationRef.current;

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let showedResults = false;
      let showedSomething = false;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { text: chunk, directives, rest } = splitStream(buffer);
          buffer = rest;
          if (chunk) setReply((r) => r + chunk);
          for (const d of directives) {
            // Once results are up, nothing else in the same reply replaces them.
            if (showedResults && d.type !== "results" && d.type !== "word-list") continue;
            if (d.type === "results") showedResults = true;
            if (d.type !== "word-list") showedSomething = true;
            await applyDirective(d);
          }
        }
      }
      // The page answered. Sage's words stay only when it's asking something.
      if (showedSomething) setReply((r) => (r.includes("?") ? r : ""));
      setReloadKey((k) => k + 1);
    } catch {
      setReply("Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  // The search form goes to Sage as a plain request.
  function searchFromForm() {
    const parts = [
      word.trim() && `word "${word.trim()}"`,
      body.trim() && `body "${body.trim()}"`,
      ...FIELD_NAMES.map(({ key, label }) => fields[key].trim() && `${label.toLowerCase()} "${fields[key].trim()}"`),
    ].filter(Boolean);
    if (parts.length === 0) return;
    publicSearch();
  }

  // Create: the form's word, body, and four fields become a new word. Sage
  // puts it where it belongs (a note, a journal entry, an idea, an
  // organization...) or asks.
  function createFromForm() {
    if (!word.trim() && !body.trim()) {
      setReply("Write a word or a body first.");
      return;
    }
    if (!isLoggedIn) {
      setReply("Log in to create words.");
      return;
    }
    if (!word.trim()) {
      setReply("Give it a word.");
      return;
    }
    setSending(true);
    setReply("");
    createWord({ type: newType, word, body, ...fields, details: newDetails })
      .then(async (made) => {
        setNewDetails({});
        if (made.open === "view") {
          const mine = await loadDictionaries();
          const d = mine.find((x) => x.id === made.id) ?? { id: made.id, name: made.name, displayKind: made.displayKind, belongs: made.belongs };
          setWord(made.name);
          setBody("");
          setFields(EMPTY_FIELDS);
          setRef(null);
          flushSave();
          setBox({ mode: "view", dictionary: d });
        } else {
          await openWord(made.kind, made.id);
        }
        setReloadKey((k) => k + 1);
      })
      .catch((err) => setReply((err as Error).message))
      .finally(() => setSending(false));
  }

  // Opens one word by what it is and its id. (Also reached from Sage, via the ref.)
  async function openWord(kind: string, id: string) {
    const res = await fetch(`/api/word?kind=${encodeURIComponent(kind)}&id=${id}`);
    if (!res.ok) return false;
    const d = await res.json();
    if (d.view) {
      setWord(d.view.name);
      setBody("");
      setFields(EMPTY_FIELDS);
      setRef(null);
      flushSave();
      setBox({ mode: "view", dictionary: d.view });
      return true;
    }
    showWord({ word: d.word, body: d.body ?? "", kind: d.kind, id: d.id, place: d.place, people: d.people, time: d.time, visibility: d.visibility });
    setOrgInfo(d.org ?? null);
    return true;
  }

  // Signed out, search goes straight to the public words.
  async function publicSearch() {
    setSending(true);
    try {
      const params = new URLSearchParams();
      if (word.trim()) params.set("word", word.trim());
      if (body.trim()) params.set("body", body.trim());
      for (const { key } of FIELD_NAMES) if (fields[key].trim()) params.set(key, fields[key].trim());
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      const items: FoundWord[] = data.items ?? [];
      setReply(data.error ?? "");
      // An exact match, any case: open it instead of listing.
      const exact = word.trim() && items.find((i) => sameWord(i.word, word));
      if (exact) {
        if (!(await openWord(exact.kind, exact.id))) showWord(exact);
        return;
      }
      lastResults.current = { items, word, body, fields };
      setBox({ mode: "results", items });
    } catch {
      setReply("Search didn't work. Try again.");
    } finally {
      setSending(false);
    }
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let heard = "";
      for (let i = event.resultIndex; i < event.results.length; i++) heard += event.results[i][0].transcript;
      setInput((prev) => (prev ? `${prev} ${heard.trim()}` : heard.trim()));
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  // Enter searches the form. On a word, Ctrl+Enter saves (Enter is a new line).
  const onFormKey = (e: React.KeyboardEvent) => {
    if (searching && e.key === "Enter" && (!e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      searchFromForm();
    } else if (box.mode === "word" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveWord();
    }
  };

  useEffect(() => {
    openWordRef.current = openWord;
    flushSaveRef.current = flushSave;
  });

  // A word-list word opens with its body ready to edit.
  async function openListWord(w: ListWord) {
    if (w.refId && w.kind !== "new") {
      if (await openWord(w.kind, w.refId)) {
        requestAnimationFrame(() => document.getElementById("body")?.focus());
        return;
      }
    }
    // A new word: its body is blank and waiting.
    showWord({ word: w.word, body: "" });
    requestAnimationFrame(() => document.getElementById("body")?.focus());
  }

  // Profile, inbox, and settings open; other things set the type to create;
  // verbs go to the Sage bar.
  function pickThing(thing: string) {
    if (thing === "profile" || thing === "inbox" || thing === "settings") {
      applyDirective({ type: "panel", panel: thing });
      return;
    }
    const t = (thing === "note" ? "notes" : thing) as WordType;
    clearToSearch();
    setNewType(t);
    setNewDetails({});
    requestAnimationFrame(() => document.getElementById("word")?.focus());
  }

  // Clicking a verb puts it in the Sage bar.
  function toBar(text: string) {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text} ` : `${text} `));
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // What kind of word is open, for the oval next to it.
  const openType =
    box.mode === "word"
      ? ref?.kind ?? "noun"
      : box.mode === "results"
        ? "search"
        : box.mode === "view"
          ? box.dictionary.belongs === "group"
            ? "group"
            : box.dictionary.displayKind === "notes_list"
              ? "note"
              : box.dictionary.displayKind
          : box.mode === "panel"
            ? box.panel
            : searching && word.trim() && isLoggedIn
              ? `new:${newType}`
              : "";

  // Words this spark can change: their own, and dictionary words for a moderator.
  const DICTIONARY_KINDS = ["noun", "verb", "word"];
  // The Stardust Dictionary is fixed: nobody edits it. You edit your own words.
  const isDictionaryWord = box.mode === "word" && Boolean(ref) && DICTIONARY_KINDS.includes(ref!.kind);
  const canSave = Boolean(ref) && isLoggedIn && !isDictionaryWord;
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  // One rule for every word: yours (or a dictionary word, for a moderator)
  // types straight in and saves itself. A new word, not made yet, gets
  // CREATE. Anyone else's word is read-only.
  const isDraft = box.mode === "word" && isLoggedIn && !ref;
  const editable = searching || isDraft || (box.mode === "word" && canSave);
  // Renaming is rare: it takes the EDIT button, then saves itself too.
  const wordEditable = searching || isDraft || (box.mode === "word" && canSave && renaming);

  // Edits save themselves a moment after you stop typing, and right away
  // when you leave the word. Each edit has a number, so a save that finishes
  // late never marks newer typing as saved.
  const editVersion = useRef(0);
  const pending = useRef<{ kind: string; id: string; draft: { word: string; body: string; place: string; people: string; time: string; visibility: string }; version: number } | null>(null);

  useEffect(() => {
    if (!dirty || !canSave || box.mode !== "word" || !ref) {
      pending.current = null;
      return;
    }
    editVersion.current += 1;
    pending.current = { kind: ref.kind, id: ref.id, draft: { word, body, ...fields }, version: editVersion.current };
    const t = setTimeout(() => flushSave(), 1200);
    return () => clearTimeout(t);
  }, [dirty, canSave, box.mode, ref, word, body, fields]);

  function flushSave() {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    setSaveState("saving");
    saveWordAction(job.kind, job.id, job.draft)
      .then(() => {
        // Only "Saved" if nothing was typed since this save started.
        if (job.version === editVersion.current) {
          setDirty(false);
          setSaveState("saved");
        }
      })
      .catch((err) => {
        setSaveState("error");
        setReply((err as Error).message);
      });
  }

  // Leaving the page with unsaved typing: save it on the way out.
  useEffect(() => {
    const onLeave = () => flushSave();
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  });

  function saveWord() {
    if (!word.trim() && !body.trim()) return;
    if (!ref) {
      createFromForm();
      return;
    }
    if (!canSave) return;
    setSending(true);
    saveWordAction(ref.kind, ref.id, { word, body, ...fields })
      .then(() => {
        setDirty(false);
        setRenaming(false);
        setReply("");
        setReloadKey((k) => k + 1);
      })
      .catch((err) => setReply((err as Error).message))
      .finally(() => setSending(false));
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-6 sm:px-8">
      {/* Top: title in the center, login and the dictionary at the right */}
      <header className="-mx-4 flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:-mx-8 sm:px-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">Stardust</h1>
          {isLoggedIn && userName && <span className="text-sm text-[var(--muted)]">{userName}</span>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button type="button" onClick={() => setPopup("open")} className="hover:underline">
            Dictionary
          </button>
          {isLoggedIn ? (
            <form action={signOut}>
              <button type="submit" className="text-[var(--muted)] hover:underline">
                Log out
              </button>
            </form>
          ) : (
            <a href="/login" className="hover:underline">
              Log in
            </a>
          )}
        </div>
      </header>

      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[22fr_58fr_20fr] lg:gap-5">
        {/* Left: Today's Word List, then Verbs and Things. On phones the list
            comes first and Verbs and Things drop below the tags. */}
        <aside className="flex min-w-0 flex-col gap-6">
          <WordListPanel isLoggedIn={isLoggedIn} list={wordList} onOpen={openListWord} />
          <div className="hidden lg:block">
            <Things onThing={pickThing} />
          </div>
        </aside>

        {/* Center: the word, its type, and its body */}
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2">
            <input
              id="word"
              value={word}
              readOnly={!wordEditable}
              onFocus={() => box.mode === "spark" && setBox({ mode: "search" })}
              onChange={(e) => {
                setWord(e.target.value);
                setDirty(true);
              }}
              onKeyDown={onFormKey}
              aria-label="Word"
              placeholder={searching || box.mode === "spark" ? "Word" : ""}
              className={`min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none sm:text-2xl ${
                wordEditable ? "placeholder:font-normal placeholder:opacity-30" : ""
              }`}
            />
            {isDictionaryWord && isLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  // Your own copy, to write in your own words.
                  setRef(null);
                  setNewType("noun");
                  setNewDetails({});
                  setReply("");
                  requestAnimationFrame(() => document.getElementById("body")?.focus());
                }}
                className="shrink-0 text-xs text-[var(--muted)] underline hover:text-[var(--foreground)]"
              >
                Make it mine
              </button>
            )}
            {box.mode === "word" && canSave && !renaming && (
              <button
                type="button"
                onClick={() => {
                  setRenaming(true);
                  requestAnimationFrame(() => document.getElementById("word")?.focus());
                }}
                className="shrink-0 text-xs text-[var(--muted)] underline hover:text-[var(--foreground)]"
              >
                Rename
              </button>
            )}

            {openType && <WordKind type={openType} />}
            {box.mode === "word" && canSave && (
              <span className="shrink-0 text-[11px] text-[var(--muted)]">
                {dirty || saveState === "saving" ? "Saving..." : saveState === "error" ? "Not saved" : saveState === "saved" ? "Saved" : ""}
              </span>
            )}
            {(box.mode !== "spark" && box.mode !== "search") || word || body || Object.values(fields).some(Boolean) ? (
              <button
                type="button"
                onClick={clearStep}
                className="shrink-0 text-xs text-[var(--muted)] underline hover:text-[var(--foreground)]"
              >
                Clear
              </button>
            ) : null}
          </div>
          {box.mode === "word" && ref?.kind === "organization" && orgInfo && (
            <p className="-mt-1 text-xs text-[var(--muted)]">
              {orgInfo.kind}
              {orgInfo.website && (
                <>
                  {" · "}
                  <a href={/^https?:/.test(orgInfo.website) ? orgInfo.website : `https://${orgInfo.website}`} target="_blank" rel="noreferrer" className="underline">
                    {orgInfo.website.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
              {orgInfo.official ? " · Official" : orgInfo.applied ? " · waiting on Official" : ""}
            </p>
          )}
          {/* The body */}
          <section className="relative flex min-h-[45vh] flex-1 flex-col rounded-lg border border-[var(--line)] p-4 sm:p-5">
            {box.mode !== "spark" && box.mode !== "search" && (
              <button
                type="button"
                onClick={clearStep}
                aria-label="Close"
                className="absolute right-2 top-1 px-2 text-2xl leading-none text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ×
              </button>
            )}
            <Box
              box={box}
              body={body}
              setBody={(b) => {
                setBody(b);
                if (box.mode === "word") setDirty(true);
              }}
              onFormKey={onFormKey}
              isLoggedIn={isLoggedIn}
              reloadKey={reloadKey}
              privateProfileId={privateProfileId}
              publicProfileId={publicProfile?.id ?? null}
              onOpen={(f) => {
            if (f.kind && f.id) openWord(f.kind, f.id).then((ok) => ok || showWord(f));
            else showWord(f);
          }}
              onChanged={() => {
                setReloadKey((k) => k + 1);
                loadDictionaries().catch(() => {});
              }}
              onClose={clearToSearch}
            />
            {box.mode === "word" && ref?.kind === "organization" && <OrgPosts orgId={ref.id} />}
          </section>

          {(searching || isDraft) && isLoggedIn && (
            <TypePicker type={newType} onType={(t) => { setNewType(t); setNewDetails({}); }} details={newDetails} onDetails={setNewDetails} />
          )}
          {(searching || isDraft) && (
            <div className="flex flex-wrap justify-center gap-3">
              {searching && (
                <button
                  type="button"
                  onClick={searchFromForm}
                  disabled={sending}
                  className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-medium hover:border-[var(--foreground)] disabled:opacity-40"
                >
                  Search
                </button>
              )}
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={createFromForm}
                  disabled={sending}
                  className="rounded-full bg-[var(--foreground)] px-4 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-40"
                >
                  Create
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right: Tags */}
        <aside className="min-w-0">
          <Panel title="Tags">
            <div className="flex flex-col gap-3">
              {FIELD_NAMES.filter(({ key }) => key !== "visibility").map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--muted)]">{label === "Place" ? "Location" : label}</span>
                  <input
                    value={fields[key]}
                    readOnly={!editable}
                    onChange={(e) => {
                      setFields((f) => ({ ...f, [key]: e.target.value }));
                      setDirty(true);
                    }}
                    onKeyDown={onFormKey}
                    className="w-full min-w-0 border-b border-[var(--line)] pb-0.5 text-sm outline-none focus:border-[var(--foreground)]"
                  />
                </label>
              ))}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-[var(--muted)]">Visibility</span>
                <span className="pb-0.5 text-sm">{(openType && visibilityOf(openType.replace(/^new:/, ""))) || (searching ? "any" : "")}</span>
              </div>
            </div>
          </Panel>
          <div className="mt-6 hidden lg:block">
            <Verbs onVerb={toBar} />
          </div>
        </aside>

        {/* Phones: Verbs and Things below the tags */}
        <div className="flex flex-col gap-6 lg:hidden">
          <Verbs onVerb={toBar} />
          <Things onThing={pickThing} />
        </div>
      </div>

      {/* Sage AI */}
      <section className="sticky bottom-0 mt-6 bg-[var(--background)] pb-2 pt-2">
        {(reply || sending) && (
          <p className="mb-2 whitespace-pre-wrap text-base leading-relaxed">
            <span className="mr-2 text-xs font-medium text-[var(--muted)]">Sage</span>
            {reply || "..."}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-lg border border-[var(--line)] p-1.5 focus-within:border-[var(--foreground)]"
        >
          {isLoggedIn && <HotkeyBox onGo={(n) => send(n)} />}
          {hasSpeech && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? "Stop listening" : "Speak"}
              className={`flex shrink-0 items-center justify-center rounded-full p-2 ${listening ? "bg-red-600 text-white" : "hover:bg-[var(--soft)]"}`}
            >
              <MicIcon />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={input.length > 90 ? 3 : 1}
            placeholder={isLoggedIn ? "Talk to Sage. Try: new note, match my idea, open Profile, settings." : "Log in to talk to Sage."}
            aria-label="Talk to Sage AI"
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-full bg-[var(--foreground)] px-4 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-30"
          >
            Enter
          </button>
        </form>
      </section>

      {popup !== "closed" && (
        <DictionaryPopup
          minimized={popup === "minimized"}
          onMinimize={() => setPopup("minimized")}
          onRestore={() => setPopup("open")}
          onClose={() => setPopup("closed")}
          onPick={(e) => {
            openWord(e.kind, e.id).then((ok) => ok || showWord({ word: e.term, body: e.body, visibility: "public" }));
            setPopup("minimized");
          }}
        />
      )}
    </main>
  );
}

function Box({
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

type ListWord = { id: string; word: string; kind: string; refId: string | null };

// What kind of word it is: a small, plain label.
function TypePill({ type }: { type: string }) {
  // A list word not made yet has no type until it's created.
  if (type === "new") return null;
  const label = type === "organization" ? "org" : type === "new-notebook" ? "group" : type === "mine" ? "noun" : type;
  return <span className="shrink-0 text-xs text-[var(--muted)]">{label}</span>;
}

// What the open word is, in the word bar: VERB, NOUN, or THING and which.
const THING_OF: Record<string, string> = {
  note: "note",
  notes: "note",
  journal: "journal",
  idea: "idea",
  resource: "resource",
  organization: "org",
  org: "org",
  organizations: "org",
  person: "profile · person",
  job: "profile · job",
  profile: "profile",
  group: "group",
  "new-notebook": "group",
  inbox: "inbox",
  settings: "settings",
};

function kindLabel(t: string): { head: string; sub: string } {
  let type = t;
  // Making a word: it's whatever type is picked, same as once it's saved.
  if (type.startsWith("new:")) type = type.slice(4);
  if (type === "verb") return { head: "VERB", sub: "" };
  if (type === "noun" || type === "word" || type === "mine") return { head: "NOUN", sub: "" };
  if (type === "search") return { head: "SEARCH", sub: "results" };
  if (type === "reports") return { head: "REPORTS", sub: "" };
  const thing = THING_OF[type];
  return thing ? { head: "THING", sub: thing } : { head: type.toUpperCase(), sub: "" };
}

function WordKind({ type }: { type: string }) {
  const { head, sub } = kindLabel(type);
  return (
    <span className="shrink-0 text-xs text-[var(--muted)]">
      <span className="font-medium text-[var(--foreground)]">{head.charAt(0) + head.slice(1).toLowerCase()}</span>
      {sub && <span className="text-[var(--muted)]"> · {sub}</span>}
    </span>
  );
}

// A bordered panel with a header bar, like the sketch.
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-[var(--line)] ${className}`}>
      <h2 className="px-3 pb-1 pt-2.5 text-xs font-medium text-[var(--muted)]">{title}</h2>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function WordListPanel({
  isLoggedIn,
  list,
  onOpen,
}: {
  isLoggedIn: boolean;
  list: { exists: boolean; words: ListWord[] };
  onOpen: (w: ListWord) => void;
}) {
  const empty = "text-sm text-[var(--muted)]";
  return (
    <Panel title="Today’s word list">
      {!isLoggedIn ? (
        <p className={empty}>Log in to keep a word list.</p>
      ) : !list.exists ? (
        <p className={empty}>No list yet. Tell Sage: new word list.</p>
      ) : list.words.length === 0 ? (
        <p className={empty}>Empty. Tell Sage: add to word list hope.</p>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {list.words.map((w) => (
            <li key={w.id} className="border-b border-[var(--line)] last:border-b-0">
              <button
                type="button"
                onClick={() => onOpen(w)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[var(--soft)]"
              >
                <span className="truncate font-medium">{w.word}</span>
                <TypePill type={w.kind} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const VERBS = ["new", "edit", "search", "view", "match", "contact", "share", "delete", "remove"];
// Things, public first, then shared, then private. A thin line between
// the three; hover says which.
const THINGS: { who: string; words: string[] }[] = [
  { who: "Public", words: ["idea", "org", "profile", "resource"] },
  { who: "Shared", words: ["group", "inbox", "settings"] },
  { who: "Private", words: ["note", "journal"] },
];

const ITEM = "px-1.5 py-0.5 text-left text-sm hover:bg-[var(--soft)] hover:underline";

function Verbs({ onVerb }: { onVerb: (text: string) => void }) {
  return (
    <Panel title="Verbs">
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-2">
        {VERBS.map((v) => (
          <button key={v} type="button" onClick={() => onVerb(v)} className={ITEM}>
            {v}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Things({ onThing }: { onThing: (thing: string) => void }) {
  return (
    <Panel title="Things">
      <div className="-mx-3 flex flex-col">
        {THINGS.map((g) => (
          <div key={g.who} title={g.who} className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-b border-[var(--line)] px-3 py-1.5 last:border-b-0 sm:grid-cols-3 lg:grid-cols-2">
            {g.words.map((w) => (
              <button key={w} type="button" onClick={() => onThing(w)} title={`${w} · ${g.who.toLowerCase()}`} className={ITEM}>
                {w}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

const PANEL_TITLES: Record<string, string> = {
  settings: "Settings",
  organizations: "Organizations",
  reports: "Reports",
  "new-notebook": "New notebook",
  inbox: "Inbox",
  profile: "Profile",
};

// The types a new word can be. The type decides its card: a noun, org,
// idea, job, resource, or person is a word and a body (plus its details);
// notes, journal, and group make a notebook that works like one.
const WORD_TYPES: { type: WordType; label: string; about: string }[] = [
  { type: "noun", label: "noun", about: "A word and what it means to you. Private." },
  { type: "org", label: "org", about: "A board: mission, announcements, contact. Public." },
  { type: "idea", label: "idea", about: "A journal anyone can read. Write entries over time." },
  { type: "job", label: "job", about: "On your profile: hiring, or looking for work. Public." },
  { type: "resource", label: "resource", about: "Something you have to lend or sell, or need. Public." },
  { type: "person", label: "person", about: "On your profile: who you are, or who you hope to meet. Public." },
  { type: "notes", label: "notes", about: "Short notes that live a day to a life. Private." },
  { type: "journal", label: "journal", about: "Entries over time. Private." },
  { type: "group", label: "group", about: "A shared notebook. Put members' emails in People." },
];

function TypePicker({
  type,
  onType,
  details,
  onDetails,
}: {
  type: WordType;
  onType: (t: WordType) => void;
  details: Record<string, string>;
  onDetails: (d: Record<string, string>) => void;
}) {
  const set = (k: string) => (e: { target: { value: string } }) => onDetails({ ...details, [k]: e.target.value });
  const sel = "rounded border border-[var(--line)] bg-[var(--background)] px-2 py-1 text-sm";
  const about = WORD_TYPES.find((t) => t.type === type)?.about;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Word type">
        <span className="mr-1 text-xs text-[var(--muted)]">Type</span>
        {WORD_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            role="radio"
            aria-checked={type === t.type}
            onClick={() => onType(t.type)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              type === t.type ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--line)] hover:border-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {about && <p className="text-xs text-[var(--muted)]">{about}</p>}
      <div className="flex flex-wrap gap-2">
        {type === "org" && (
          <>
            <select value={details.kind ?? "other"} onChange={set("kind")} aria-label="Organization type" className={sel}>
              <option value="business">Business</option>
              <option value="government">Government</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="other">Other</option>
            </select>
            <input value={details.website ?? ""} onChange={set("website")} placeholder="Website" aria-label="Website" className={sel} />
          </>
        )}
        {(type === "job" || type === "resource" || type === "person") && (
          <select value={details.side ?? "offer"} onChange={set("side")} aria-label="Offer or seek" className={sel}>
            <option value="offer">{type === "person" ? "Who I am" : type === "job" ? "Hiring" : type === "resource" ? "Have" : "My idea"}</option>
            <option value="seek">{type === "person" ? "Who I hope to meet" : type === "job" ? "Looking for work" : type === "resource" ? "Need" : "An idea to join"}</option>
          </select>
        )}
        {type === "person" && (
          <select value={details.relationship ?? "friendship"} onChange={set("relationship")} aria-label="Relationship" className={sel}>
            <option value="friendship">Friendship</option>
            <option value="business">Business</option>
            <option value="romance" disabled>
              Romance (set up in Profile)
            </option>
          </select>
        )}
        {type === "job" && <input value={details.pay ?? ""} onChange={set("pay")} placeholder="Pay" aria-label="Pay" className={sel} />}
        {type === "resource" && (
          <>
            <select value={details.deal ?? ""} onChange={set("deal")} aria-label="Free, sale, or trade" className={sel}>
              <option value="">Free, sale, or trade?</option>
              <option value="free">Free</option>
              <option value="sale">For sale</option>
              <option value="trade">Trade</option>
            </select>
            {details.deal === "sale" && <input value={details.price ?? ""} onChange={set("price")} placeholder="Price" aria-label="Price" className={sel} />}
          </>
        )}
        {type === "group" && (
          <select value={details.style ?? "night"} onChange={set("style")} aria-label="Group writes" className={sel}>
            <option value="night">Shared notes</option>
            <option value="journal">Shared journal</option>
          </select>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </svg>
  );
}

// The # box: type a hotkey number (1 to 50) and Enter goes straight there.
function HotkeyBox({ onGo }: { onGo: (n: string) => void }) {
  const [n, setN] = useState("");
  return (
    <label className="flex shrink-0 items-center gap-0.5 border-r border-[var(--line)] pl-1 pr-2 text-sm text-[var(--muted)]">
      #
      <input
        value={n}
        maxLength={5}
        onChange={(e) => setN(e.target.value.replace(/[^a-z0-9]/gi, "").toLowerCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && n) {
            e.preventDefault();
            // Numbers are hotkeys; letters are built-in codes or tickers.
            onGo(/^\d+$/.test(n) ? n : `#${n}`);
            setN("");
          }
        }}
        aria-label="Hotkey number"
        title="Shortcut: a hotkey number, or j journals, n notes, i ideas, o orgs, g groups, r resources, w nouns, p profile (pp pi pj pr), s settings, m inbox"
        className="w-11 bg-transparent text-[var(--foreground)] outline-none"
      />
    </label>
  );
}
