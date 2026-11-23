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
  | { mode: "results"; items: FoundWord[] }
  | { mode: "view"; dictionary: MyDictionary }
  | { mode: "panel"; panel: "settings" | "organizations" | "new-notebook" | "reports" | "inbox" | "profile" };

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

// "Peacemaker's Notes" is stored with the owner's name; on your own page
// it's just "Notes".
function shortName(name: string): string {
  return name.replace(/^.{1,40}?['â€™]s\s+/, "") || name;
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

export function Stardust({ isLoggedIn, userName }: { isLoggedIn: boolean; userName: string | null }) {
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
  const editable = searching || (box.mode === "word" && isLoggedIn);
  // Renaming a word is rare: it takes the Edit button.
  const [renaming, setRenaming] = useState(false);
  // Create: what kind of word this is, and that kind's own details.
  const [newType, setNewType] = useState<WordType>("noun");
  const [newDetails, setNewDetails] = useState<Record<string, string>>({});
  const wordEditable = searching || (box.mode === "word" && isLoggedIn && renaming);

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

  function clearToSearch() {
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
    setRenaming(false);
    if (w.kind !== "organization") setOrgInfo(null);
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
          setBox({ mode: "results", items: d.items });
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
          setBox({ mode: "panel", panel: d.panel });
          break;
        case "clear":
          clearToSearch();
          break;
        case "word-list":
          await loadWordList();
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
    if (!isLoggedIn) {
      publicSearch();
      return;
    }
    send(`Search: ${parts.join(", ")}`);
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
          setBox({ mode: "view", dictionary: d });
        } else {
          await openWord(made.kind, made.id);
        }
        setReloadKey((k) => k + 1);
      })
      .catch((err) => setReply((err as Error).message))
      .finally(() => setSending(false));
  }

  // Opens one word by what it is and its id.
  async function openWord(kind: string, id: string) {
    const res = await fetch(`/api/word?kind=${encodeURIComponent(kind)}&id=${id}`);
    if (!res.ok) return false;
    const d = await res.json();
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
      setBox({ mode: "results", items: data.items ?? [] });
      setReply(data.error ?? "");
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
    if (searching && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      searchFromForm();
    } else if (box.mode === "word" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveWord();
    }
  };

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
      ? ref?.kind ?? "word"
      : box.mode === "results"
        ? "search"
        : box.mode === "view"
          ? "view"
          : box.mode === "panel"
            ? box.panel
            : "";

  function saveWord() {
    if (!word.trim() && !body.trim()) return;
    if (!ref || ["noun", "verb", "word"].includes(ref.kind)) {
      // A dictionary word or a new one: make it yours as a noun.
      setNewType("noun");
      setBox({ mode: "search" });
      setRef(null);
      setReply("Pick its type and press Create.");
      return;
    }
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
      <header className="relative flex flex-col items-center pt-6 sm:pt-8">
        <div className="absolute right-0 top-6 flex flex-col items-end gap-1 text-sm sm:top-8">
          {isLoggedIn ? (
            <form action={signOut}>
              <button type="submit" className="hover:underline">
                Logout
              </button>
            </form>
          ) : (
            <a href="/login" className="hover:underline">
              Login
            </a>
          )}
          <button type="button" onClick={() => setPopup("open")} className="hover:underline">
            Dictionary
          </button>
        </div>
        <h1 className="text-4xl font-light tracking-[0.45em] sm:text-6xl">STARDUST</h1>
        {isLoggedIn && userName && <p className="mt-1 text-base text-[var(--muted)] sm:text-lg">{userName}</p>}
      </header>

      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[25fr_65fr_10fr] lg:gap-5">
        {/* Left: Today's Word List, then Verbs and Things. On phones the list
            comes first and Verbs and Things drop below the tags. */}
        <aside className="flex min-w-0 flex-col gap-6">
          <WordListPanel isLoggedIn={isLoggedIn} list={wordList} onOpen={openListWord} />
          <div className="hidden lg:flex lg:flex-col lg:gap-6">
            <VerbsAndThings onVerb={toBar} onThing={pickThing} />
          </div>
        </aside>

        {/* Center: the word, its type, and its body */}
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3 border-[1.5px] border-[var(--foreground)] px-3 py-2">
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
              className={`min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none sm:text-3xl ${
                wordEditable ? "placeholder:font-normal placeholder:opacity-30" : ""
              }`}
            />
            {box.mode === "word" && isLoggedIn && !renaming && (
              <button
                type="button"
                onClick={() => {
                  setRenaming(true);
                  requestAnimationFrame(() => document.getElementById("word")?.focus());
                }}
                className="shrink-0 self-center border border-[var(--foreground)] px-2 py-0.5 text-[11px] font-semibold tracking-widest hover:bg-[var(--foreground)] hover:text-[var(--background)]"
              >
                EDIT
              </button>
            )}

            {openType && <TypePill type={openType} />}
          </div>
          {box.mode === "word" && ref?.kind === "organization" && orgInfo && (
            <p className="-mt-1 text-xs text-[var(--muted)]">
              {orgInfo.kind}
              {orgInfo.website && (
                <>
                  {" Â· "}
                  <a href={/^https?:/.test(orgInfo.website) ? orgInfo.website : `https://${orgInfo.website}`} target="_blank" rel="noreferrer" className="underline">
                    {orgInfo.website.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
              {orgInfo.official ? " Â· Official" : orgInfo.applied ? " Â· waiting on Official" : ""}
            </p>
          )}
          {/* The body */}
          <section className="relative flex min-h-[45vh] flex-1 flex-col border-[1.5px] border-[var(--foreground)] p-4 sm:p-6">
            {box.mode !== "spark" && box.mode !== "search" && (
              <button
                type="button"
                onClick={clearToSearch}
                aria-label="Close"
                className="absolute right-2 top-1 px-2 text-2xl leading-none text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Ã—
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
          </section>

          {searching && isLoggedIn && (
            <TypePicker type={newType} onType={(t) => { setNewType(t); setNewDetails({}); }} details={newDetails} onDetails={setNewDetails} />
          )}
          {(searching || (box.mode === "word" && isLoggedIn && dirty)) && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={searching ? searchFromForm : saveWord}
                disabled={sending}
                className="border-[1.5px] border-[var(--foreground)] px-5 py-1 text-xs font-bold tracking-[0.2em] hover:bg-[var(--soft)] disabled:opacity-40"
              >
                {searching ? "SEARCH" : "SAVE"}
              </button>
              {searching && (
                <button
                  type="button"
                  onClick={createFromForm}
                  disabled={sending}
                  className="border-[1.5px] border-[var(--foreground)] bg-[var(--foreground)] px-5 py-1 text-xs font-bold tracking-[0.2em] text-[var(--background)] disabled:opacity-40"
                >
                  CREATE
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right: Tags */}
        <aside className="min-w-0">
          <Panel title="TAGS">
            <div className="flex flex-col gap-3">
              {FIELD_NAMES.map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{label === "Place" ? "Location" : label}</span>
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
            </div>
          </Panel>
        </aside>

        {/* Phones: Verbs and Things below the tags */}
        <div className="flex flex-col gap-6 lg:hidden">
          <VerbsAndThings onVerb={toBar} onThing={pickThing} />
        </div>
      </div>

      {/* Sage AI */}
      <section className="sticky bottom-0 mt-6 bg-[var(--background)] pb-2 pt-2">
        {(reply || sending) && (
          <p className="mb-2 whitespace-pre-wrap text-base leading-relaxed">
            <span className="mr-2 text-[11px] font-bold tracking-[0.2em]">SAGE</span>
            {reply || "..."}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-stretch gap-2 border-[1.5px] border-[var(--foreground)] p-1.5"
        >
          {hasSpeech && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? "Stop listening" : "Speak"}
              className={`flex shrink-0 items-center justify-center px-3 ${listening ? "bg-red-600 text-white" : "hover:bg-[var(--soft)]"}`}
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
            className="min-w-0 flex-1 resize-none border-x border-[var(--line)] bg-transparent px-3 py-1.5 text-base outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 bg-[var(--foreground)] px-5 text-xs font-bold tracking-[0.2em] text-[var(--background)] disabled:opacity-30"
          >
            ENTER
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
            showWord({ word: e.term, body: e.body, visibility: "public" });
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
      if (box.mode === "word" && !isLoggedIn) return <div className="whitespace-pre-wrap pr-6 text-lg leading-relaxed">{body}</div>;
      return (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onFormKey}
          placeholder={box.mode === "word" ? "Write its meaning here." : isLoggedIn ? "" : "Search public words. Log in to write your own."}
          id="body"
          aria-label="Body"
          className="min-h-[40vh] w-full flex-1 resize-none pr-6 text-lg leading-relaxed outline-none placeholder:opacity-30"
        />
      );
    case "results":
      return box.items.length === 0 ? (
        <p className="opacity-60">Nothing found. Try fewer words, or a wider time.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line)] pr-6">
          {box.items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button type="button" onClick={() => onOpen(item)} className="flex w-full flex-col gap-1 py-3 text-left hover:opacity-70">
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold">{item.word}</span>
                  <TypePill type={item.kind} />
                </span>
                <span className="line-clamp-2 text-sm text-[var(--muted)]">{item.body}</span>
                <span className="text-xs opacity-50">
                  {[item.details, item.place, item.people, item.time, item.visibility].filter(Boolean).join(" Â· ")}
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
              {publicProfileId && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold tracking-[0.2em] text-neutral-900">ABOUT ME</h3>
                  <ProfileFields dictionaries={[{ id: publicProfileId, name: "Profile" }]} reloadKey={reloadKey} />
                </div>
              )}
              <ProfileView reloadKey={reloadKey} />
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
  const label = type === "organization" ? "org" : type === "new-notebook" ? "group" : type === "mine" ? "noun" : type;
  return <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">{label}</span>;
}

// A bordered panel with a header bar, like the sketch.
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border-[1.5px] border-[var(--foreground)] ${className}`}>
      <h2 className="border-b-[1.5px] border-[var(--foreground)] px-3 py-1.5 text-[11px] font-bold tracking-[0.2em]">{title}</h2>
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
    <Panel title="TODAYâ€™S WORD LIST">
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
// Things, by who sees them.
const THINGS: { group: string; words: string[] }[] = [
  { group: "Public", words: ["idea", "org", "profile", "resource"] },
  { group: "Shared", words: ["group", "inbox", "settings"] },
  { group: "Private", words: ["note", "journal"] },
];

function VerbsAndThings({ onVerb, onThing }: { onVerb: (text: string) => void; onThing: (thing: string) => void }) {
  const item = "px-1.5 py-0.5 text-left text-sm hover:bg-[var(--soft)] hover:underline";
  return (
    <>
      <Panel title="VERBS">
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-2">
          {VERBS.map((v) => (
            <button key={v} type="button" onClick={() => onVerb(v)} className={item}>
              {v}
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="THINGS">
        <div className="flex flex-col gap-2">
          {THINGS.map((g) => (
            <div key={g.group}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{g.group}</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-2">
                {g.words.map((w) => (
                  <button key={w} type="button" onClick={() => onThing(w)} className={item}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
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
  { type: "noun", label: "noun", about: "A word and what it means to you." },
  { type: "org", label: "org", about: "A business, government, nonprofit, or other: its mission, news, contact." },
  { type: "idea", label: "idea", about: "On your profile. Others with matching words find it." },
  { type: "job", label: "job", about: "On your profile: hiring, or looking for work." },
  { type: "resource", label: "resource", about: "On your profile: something you have or need." },
  { type: "person", label: "person", about: "On your profile: who you are, or who you hope to meet." },
  { type: "notes", label: "notes", about: "A notebook of short notes that each live a day to a life." },
  { type: "journal", label: "journal", about: "A private journal of longer entries." },
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
        <span className="mr-1 text-[10px] font-semibold tracking-[0.2em] text-[var(--muted)]">TYPE</span>
        {WORD_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            role="radio"
            aria-checked={type === t.type}
            onClick={() => onType(t.type)}
            className={`border px-2.5 py-0.5 text-xs ${
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
        {(type === "idea" || type === "job" || type === "resource" || type === "person") && (
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
