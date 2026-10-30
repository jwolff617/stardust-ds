"use client";

import { useEffect, useState } from "react";
import type { Board, BoardView } from "@/lib/posts";

export type Filters = {
  view: BoardView;
  kinds: string[];
  labels: string[];
  q: string;
  neighborhood: string;
  sort: "new" | "votes";
};

export const EMPTY_FILTERS: Filters = { view: "all", kinds: [], labels: [], q: "", neighborhood: "", sort: "new" };

const EMPTY_BOARD: Board = {
  address: "",
  intro: "",
  settings: {},
  kinds: [],
  labels: [],
  neighborhoods: [],
  posts: [],
  waiting: 0,
  mineOpen: [],
  me: { userId: "", isSteward: false, adultConfirmed: false, organizations: [], blocked: [] },
  review: null,
};

// Loads one board for the filters given, and sends actions to it. Every
// action reloads the board, so what you see is what the database holds.
export function useBoard(dictionaryId: string, filters: Filters, reloadKey: number) {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const key = JSON.stringify(filters);
  useEffect(() => {
    const f = JSON.parse(key) as Filters;
    const controller = new AbortController();
    const params = new URLSearchParams({
      dictionaryId,
      view: f.view,
      kinds: f.kinds.join(","),
      labels: f.labels.join(","),
      q: f.q,
      neighborhood: f.neighborhood,
      sort: f.sort,
    });
    // A short wait so typing in search doesn't send a request per letter.
    const timer = setTimeout(() => {
      fetch(`/api/posts?${params}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setBoard(data);
          setLoaded(true);
          setError(null);
        })
        .catch((err) => {
          if ((err as Error).name !== "AbortError") setError((err as Error).message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dictionaryId, key, refreshToken, reloadKey]);

  // New messages show up on their own: a quiet reload every 20 seconds
  // while the page is open in front of you.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setRefreshToken((t) => t + 1);
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  // Sends one action. Resolves to the response's data, or null on failure
  // (the error shows on the board).
  async function send(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictionaryId, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return null;
      }
      return data;
    } catch {
      setError("Couldn't reach Stardust. Check your connection and try again.");
      return null;
    } finally {
      setRefreshToken((t) => t + 1);
    }
  }

  return { board, loaded, error, setError, send, refresh: () => setRefreshToken((t) => t + 1) };
}
