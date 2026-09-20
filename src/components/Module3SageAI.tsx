"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

type Message = { id: string; role: "user" | "assistant" | "tool"; content: string };
type ConversationSummary = { id: string; title: string | null; updated_at: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function noopSubscribe() {
  return () => {};
}

function getSpeechSupportSnapshot() {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function getSpeechSupportServerSnapshot() {
  return false;
}

export function Module3SageAI({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, startSending] = useTransition();
  const [isListBusy, startListBusy] = useTransition();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const hasSpeechSupport = useSyncExternalStore(
    noopSubscribe,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );

  useEffect(() => {
    if (!isLoggedIn) return;

    startListBusy(async () => {
      try {
        const res = await fetch("/api/sage-ai/conversations");
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } catch {
        setConversations([]);
      }
    });
  }, [isLoggedIn]);

  function openConversation(id: string) {
    setConversationId(id);
    setMessages([]);
    startListBusy(async () => {
      try {
        const res = await fetch(`/api/sage-ai/conversations/${id}`);
        const data = await res.json();
        type RawMessage = { id: string; role: Message["role"]; content: string };
        setMessages((data.messages ?? []).map((m: RawMessage) => ({ id: m.id, role: m.role, content: m.content })));
      } catch {
        setMessages([]);
      }
    });
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
  }

  function forgetConversation(id: string) {
    startListBusy(async () => {
      await fetch(`/api/sage-ai/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
    });
  }

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
    setInput("");

    startSending(async () => {
      try {
        const res = await fetch("/api/sage-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, conversationId }),
        });

        const newConversationId = res.headers.get("X-Conversation-Id");
        if (newConversationId && newConversationId !== conversationId) {
          setConversationId(newConversationId);
        }

        const assistantId = crypto.randomUUID();
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
            );
          }
        }

        const listRes = await fetch("/api/sage-ai/conversations");
        const listData = await listRes.json();
        setConversations(listData.conversations ?? []);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong." },
        ]);
      }
    });
  }

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }

  if (!isLoggedIn) {
    return (
      <section className="px-6 py-6">
        <p className="text-sm text-neutral-400">Sign in to talk to Sage AI.</p>
      </section>
    );
  }

  return (
    <section className="flex gap-6 px-6 py-6">
      <aside className="flex w-48 shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-neutral-500">Conversations</h3>
          <button type="button" className="text-xs underline" onClick={startNewConversation}>
            New
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {conversations.map((c) => (
            <div key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className={`flex-1 truncate rounded px-2 py-1 text-left text-sm ${
                  c.id === conversationId ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
                }`}
              >
                {c.title || "Untitled"}
              </button>
              <button
                type="button"
                title="Forget"
                onClick={() => forgetConversation(c.id)}
                className="px-1 text-xs text-neutral-400 hover:text-neutral-700"
              >
                ×
              </button>
            </div>
          ))}
          {isListBusy && conversations.length === 0 && (
            <p className="px-2 text-xs text-neutral-400">Loading...</p>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex min-h-40 flex-col gap-3 rounded border border-neutral-200 p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-neutral-400">Tell Sage AI what to do.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="mr-2 text-xs font-medium uppercase text-neutral-400">
                  {m.role === "user" ? "You" : "Sage"}
                </span>
                <span className="whitespace-pre-wrap text-neutral-800">{m.content}</span>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="note write groceries milk, eggs, bread"
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          {hasSpeechSupport && (
            <button
              type="button"
              onClick={toggleListening}
              className={`rounded-full px-3 py-2 text-xs font-medium ${
                isListening ? "bg-red-600 text-white" : "border border-neutral-300 text-neutral-600"
              }`}
            >
              {isListening ? "Listening..." : "Voice"}
            </button>
          )}
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}
