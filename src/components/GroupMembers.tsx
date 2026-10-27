"use client";

import { useEffect, useState } from "react";

type Member = { userId: string; name: string; role: string; isMe: boolean };

// A group dictionary's members. The owner adds people by email and removes
// them; anyone can leave.
export function GroupMembers({
  dictionaryId,
  reloadKey,
  onError,
}: {
  dictionaryId: string;
  reloadKey: number;
  onError: (message: string | null) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/groups/members?dictionaryId=${dictionaryId}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members ?? []);
        setIsOwner(Boolean(data.isOwner));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [dictionaryId, refreshToken, reloadKey]);

  async function run(body: Record<string, unknown>) {
    onError(null);
    try {
      const res = await fetch("/api/groups/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictionaryId, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }
      setEmail("");
    } catch (err) {
      onError((err as Error).message);
    }
    setRefreshToken((t) => t + 1);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3 text-xs">
      <span className="font-medium text-neutral-500">Members</span>
      {members.map((m) => (
        <span key={m.userId} className="flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5">
          {m.name}
          {m.role === "owner" && <span className="text-neutral-400">owner</span>}
          {m.role !== "owner" && (isOwner || m.isMe) && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(m.isMe ? "Leave this group?" : `Remove ${m.name}?`)) run({ removeUserId: m.userId });
              }}
              aria-label={m.isMe ? "Leave group" : `Remove ${m.name}`}
              className="text-neutral-400 hover:text-red-600"
            >
              ✕
            </button>
          )}
        </span>
      ))}
      {isOwner && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) run({ email });
          }}
          className="flex items-center gap-1"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Add by email"
            className="w-44 rounded-full border border-dashed border-neutral-300 px-2 py-0.5"
          />
          <button type="submit" className="rounded-full border border-neutral-300 px-2 py-0.5 font-medium">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
