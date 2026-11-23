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
  | { mode: "panel"; panel: "settings" | "organizations" | "new-notebook" | "reports" };

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

export function Stardust({ isLoggedIn, userName }: { isLoggedIn: boolean; userName: string | null }) {
  const [word, setWord] = useState("");
  const [body, setBody] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [box, setBox] = useState<Box>(isLoggedIn ? { mode: "search" } : { mode: "spark" });
  const [dictionaries, setDictionaries] = useState<MyDictionary[]>([]);
  // The private profile lives behind Settings, not in the list.
  const [privateProfileId, setPrivateProfileId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [popup, setPopup] = useState<"closed" | "open" | "minimized">("closed");

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
  const [dirty, setDirty] = useState(false);
  // The search form is always typeable. A word is typeable when signed in:
  // the rectangle is where its meaning gets written.
  const searching = box.mode === "search";
  const editable = searching || (box.mode === "word" && isLoggedIn);
  // Renaming a word is rare: it takes the Edit button.
  const [renaming, setRenaming] = useState(false);
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
          setWord(d.panel === "settings" ? "Settings" : d.panel === "organizations" ? "Organizations" : d.panel === "reports" ? "Reports" : "New notebook");
          setBody("");
          setFields(EMPTY_FIELDS);
          setBox({ mode: "panel", panel: d.panel });
          break;
        case "clear":
          clearToSearch();
          break;
      }
    },
    [dictionaries, loadDictionaries],
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
            if (showedResults && d.type !== "results") continue;
            if (d.type === "results") showedResults = true;
            await applyDirective(d);
          }
        }
      }
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
    const parts = [
      `word "${word.trim()}"`,
      body.trim() && `body "${body.trim()}"`,
      ...FIELD_NAMES.map(({ key, label }) => fields[key].trim() && `${label.toLowerCase()} "${fields[key].trim()}"`),
    ].filter(Boolean);
    send(`Create a new word: ${parts.join(", ")}. If it's not clear what it is (a note, a journal entry, an idea, a job, a resource, a person, an organization), ask me.`);
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

  function saveWord() {
    if (!word.trim() && !body.trim()) return;
    send(ref ? `Save my changes to this ${ref.kind}.` : "Save the word on the page. If it's new, ask me where it goes unless it's clear.");
    setDirty(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 sm:px-8">
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
          <button type="button" onClick={() => setPopup("open")} className="opacity-70 hover:underline hover:opacity-100">
            Dictionary
          </button>
        </div>
        <h1 className="text-4xl font-light tracking-[0.45em] sm:text-6xl">STARDUST</h1>
        {isLoggedIn && userName && <p className="mt-2 text-base opacity-70 sm:text-lg">{userName}</p>}
      </header>

      {/* WORD */}
      <div className="mt-8 flex items-baseline gap-3 sm:mt-10">
        <label htmlFor="word" className="shrink-0 text-2xl font-semibold tracking-widest sm:text-4xl">
          WORD:
        </label>
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
          className={`min-w-0 flex-1 bg-transparent pb-1 text-2xl outline-none sm:text-4xl ${
            wordEditable ? "border-b border-[var(--line)] focus:border-[var(--foreground)]" : "border-b border-transparent"
          }`}
        />
        {box.mode === "word" && isLoggedIn && !renaming && (
          <button
            type="button"
            onClick={() => {
              setRenaming(true);
              requestAnimationFrame(() => document.getElementById("word")?.focus());
            }}
            className="shrink-0 self-center text-xs tracking-widest opacity-50 hover:opacity-100"
          >
            EDIT
          </button>
        )}
      </div>

      {/* The rectangle */}
      <section className="relative mt-6 flex min-h-[45vh] flex-col rounded-md border-2 border-[var(--foreground)] p-4 sm:p-6">
        {box.mode !== "spark" && box.mode !== "search" && (
          <button
            type="button"
            onClick={clearToSearch}
            aria-label="Close"
            className="absolute right-2 top-1 px-2 text-2xl leading-none opacity-60 hover:opacity-100"
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
          onOpen={(f) => showWord(f)}
          onChanged={() => {
            setReloadKey((k) => k + 1);
            loadDictionaries().catch(() => {});
          }}
          onClose={clearToSearch}
        />
      </section>

      {/* Place, People, Time, Visibility */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
        {FIELD_NAMES.map(({ key, label }) => (
          <label key={key} className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs font-semibold tracking-[0.25em] opacity-60">{label.toUpperCase()}</span>
            <input
              value={fields[key]}
              readOnly={!editable}
              onChange={(e) => {
                setFields((f) => ({ ...f, [key]: e.target.value }));
                setDirty(true);
              }}
              onKeyDown={onFormKey}
              className="w-full border-b border-[var(--line)] pb-1 text-center text-base outline-none placeholder:opacity-30"
            />
          </label>
        ))}
      </div>
      {(searching || (box.mode === "word" && isLoggedIn && dirty)) && (
        <div className="mt-3 flex justify-center gap-3">
          <button
            type="button"
            onClick={searching ? searchFromForm : saveWord}
            disabled={sending}
            className="rounded-full border border-[var(--foreground)] px-5 py-1 text-sm tracking-widest disabled:opacity-40"
          >
            {searching ? "SEARCH" : "SAVE"}
          </button>
          {searching && (
            <button
              type="button"
              onClick={createFromForm}
              disabled={sending}
              className="rounded-full bg-[var(--foreground)] px-5 py-1 text-sm tracking-widest text-[var(--background)] disabled:opacity-40"
            >
              CREATE
            </button>
          )}
        </div>
      )}

      {/* Sage AI */}
      <section className="mt-6">
        {(reply || sending) && (
          <p className="mb-2 whitespace-pre-wrap text-base leading-relaxed">
            <span className="mr-2 text-xs font-semibold tracking-widest opacity-50">SAGE</span>
            {reply || "..."}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-stretch gap-2 rounded-md border-2 border-[var(--foreground)] p-2"
        >
          {hasSpeech && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? "Stop listening" : "Speak"}
              className={`shrink-0 rounded-md px-3 text-sm ${listening ? "bg-red-600 text-white" : "border border-[var(--line)]"}`}
            >
              {listening ? "● Stop" : "🎤"}
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
            rows={input.length > 90 ? 4 : 2}
            placeholder={isLoggedIn ? "Talk to Sage. Try: new note, match my idea, open Profile, settings." : "Log in to talk to Sage."}
            aria-label="Talk to Sage AI"
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-lg outline-none placeholder:opacity-40"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-md bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] disabled:opacity-30"
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
                  <span className="text-xs tracking-widest opacity-50">{item.kind.toUpperCase()}</span>
                </span>
                <span className="line-clamp-2 text-sm opacity-75">{item.body}</span>
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
