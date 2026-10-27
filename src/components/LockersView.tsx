"use client";

import { useEffect, useState } from "react";
import { formatDate, type Post } from "@/lib/lockers";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/lockers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Something went wrong.");
  }
}

// Lockers Display View: the public page. Everyone reads the hours, rules,
// and announcements; Lockers Admin members edit them in place.
export function LockersView({ reloadKey = 0 }: { reloadKey?: number }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/lockers", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPosts(data.posts ?? []);
        setCanEdit(Boolean(data.canEdit));
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      });
    return () => controller.abort();
  }, [refreshToken, reloadKey]);

  async function run(body: Record<string, unknown>) {
    setError(null);
    try {
      await post(body);
    } catch (err) {
      setError((err as Error).message);
    }
    setRefreshToken((t) => t + 1);
  }

  const block = (kind: "hours" | "rules") => posts.find((p) => p.kind === kind);
  const announcements = posts.filter((p) => p.kind === "announcement");

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-xs font-medium text-neutral-500">Lockers</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Announcements</h4>
        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) run({ kind: "announcement", body: draft }).then(() => setDraft(""));
            }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="New announcement"
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            <button type="submit" className="self-start rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium">
              Post
            </button>
          </form>
        )}
        {announcements.length === 0 ? (
          <p className="text-sm text-neutral-400">No announcements.</p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="flex flex-col gap-1 border-b border-neutral-100 pb-2">
              <span className="text-xs text-neutral-400">{formatDate(a.createdAt.slice(0, 10))}</span>
              {canEdit ? (
                <div className="flex items-start gap-2">
                  <textarea
                    key={`${a.id}-${a.body}`}
                    defaultValue={a.body}
                    rows={2}
                    onBlur={(e) => e.target.value !== a.body && run({ id: a.id, kind: "announcement", body: e.target.value })}
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => window.confirm("Delete this announcement?") && run({ deleteId: a.id })}
                    aria-label="Delete announcement"
                    className="text-neutral-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{a.body}</p>
              )}
            </div>
          ))
        )}
      </section>

      {(["hours", "rules"] as const).map((kind) => {
        const current = block(kind);
        return (
          <section key={kind} className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">{kind === "hours" ? "Hours" : "Rules"}</h4>
            {canEdit ? (
              <textarea
                key={`${kind}-${current?.body ?? ""}`}
                defaultValue={current?.body ?? ""}
                rows={kind === "hours" ? 4 : 10}
                placeholder={kind === "hours" ? "When the lockers are open" : "What everyone with a locker agrees to"}
                onBlur={(e) => e.target.value !== (current?.body ?? "") && run({ kind, body: e.target.value })}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            ) : current?.body ? (
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{current.body}</p>
            ) : (
              <p className="text-sm text-neutral-400">Not posted yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
