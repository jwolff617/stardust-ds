"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DictionaryPopup } from "./DictionaryPopup";
import type { Belongs, MyDictionary } from "./DictionaryView";
import { signOut } from "@/app/login/actions";
import { createWord, saveWord as saveWordAction, type WordType } from "@/app/actions/words";
import { OrgPosts } from "./OrgPosts";
import { visibilityOf } from "@/lib/visibility";
import { HotkeyBox, MicIcon, PANEL_TITLES, Panel, Things, TypePicker, Verbs, WordKind, WordListPanel, type ListWord } from "./StardustParts";
import { StardustDisplay, type Box } from "./StardustDisplay";
import { MyNounsBox } from "./MyNouns";
import type { MyNoun } from "@/lib/shortcuts";
import { splitStream, type FoundWord, type UiDirective, type WordFields } from "@/lib/sage-ui";

type Fields = Required<WordFields>;
const EMPTY_FIELDS: Fields = { place: "", people: "", time: "", visibility: "" };
const FIELD_NAMES: { key: keyof Fields; label: string }[] = [
  { key: "place", label: "Place" },
  { key: "people", label: "People" },
  { key: "time", label: "Time" },
  { key: "visibility", label: "Visibility" },
];


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
  const [nouns, setNouns] = useState<MyNoun[]>([]);
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

  const loadNouns = useCallback(() => {
    if (!isLoggedIn) return;
    fetch("/api/my-nouns")
      .then((r) => r.json())
      .then((d) => setNouns(d.nouns ?? []))
      .catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/my-nouns")
      .then((r) => r.json())
      .then((d) => setNouns(d.nouns ?? []))
      .catch(() => {});
  }, [isLoggedIn, reloadKey]);

  // Opening one of your nouns counts it (Recent and Top 10).
  function countOpen(kind: string, id: string) {
    if (!isLoggedIn) return;
    const mine = nouns.some((n) => n.kind === kind && n.id === id) || ["notebook", "organization", "resource", "mine"].includes(kind);
    if (!mine) return;
    setNouns((list) => list.map((n) => (n.kind === kind && n.id === id ? { ...n, opens: n.opens + 1, lastOpened: new Date().toISOString() } : n)));
    fetch("/api/my-nouns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) }).catch(() => {});
  }

  function starNoun(n: MyNoun) {
    setNouns((list) => list.map((x) => (x.kind === n.kind && x.id === n.id ? { ...x, favorite: !n.favorite } : x)));
    fetch("/api/my-nouns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: n.kind, id: n.id, favorite: !n.favorite }) }).catch(() => {});
  }

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
        loadNouns();
      })
      .catch((err) => setReply((err as Error).message))
      .finally(() => setSending(false));
  }

  // Opens one word by what it is and its id. (Also reached from Sage, via the ref.)
  // Phones: Things and My nouns sit below the display, so bring it into view.
  function showDisplay() {
    if (window.innerWidth < 1024) document.getElementById("word")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function openWord(kind: string, id: string) {
    countOpen(kind, id);
    showDisplay();
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
    showDisplay();
    if (thing === "profile" || thing === "inbox" || thing === "settings") {
      applyDirective({ type: "panel", panel: thing });
      return;
    }
    if (thing === "my nouns") {
      applyDirective({ type: "panel", panel: "nouns" });
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
          {isLoggedIn && (
            <div className="hidden lg:block">
              <MyNounsBox
                nouns={nouns}
                onOpen={(n) => openWord(n.kind, n.id)}
                onStar={starNoun}
                onViewAll={() => applyDirective({ type: "panel", panel: "nouns" })}
              />
            </div>
          )}
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
            <StardustDisplay
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
              nouns={nouns}
              onOpenNoun={(n) => openWord(n.kind, n.id)}
              onStarNoun={starNoun}
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
          {isLoggedIn && (
            <MyNounsBox
              nouns={nouns}
              onOpen={(n) => openWord(n.kind, n.id)}
              onStar={starNoun}
              onViewAll={() => applyDirective({ type: "panel", panel: "nouns" })}
            />
          )}
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
