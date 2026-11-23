"use client";

import { useEffect, useState } from "react";
import { addOrgPost, deleteOrgPost, orgPosts, type OrgPost } from "@/app/actions/words";
import { formatDate } from "./ui";

// An org's announcements, newest first, under its board. Its admins post.
export function OrgPosts({ orgId }: { orgId: string }) {
  const [posts, setPosts] = useState<OrgPost[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    orgPosts(orgId)
      .then((r) => {
        setPosts(r.posts);
        setIsAdmin(r.isAdmin);
      })
      .catch((err) => setError((err as Error).message));
  }, [orgId, token]);

  async function run(work: () => Promise<void>) {
    setError(null);
    try {
      await work();
      setToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!posts) return error ? <p className="text-xs text-red-600">{error}</p> : null;
  if (posts.length === 0 && !isAdmin) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
      <h3 className="text-xs font-medium text-[var(--muted)]">Announcements</h3>
      {isAdmin && (
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={5000}
            placeholder="Post an announcement"
            aria-label="New announcement"
            className="min-w-0 flex-1 resize-y rounded-md border border-[var(--line)] p-2 text-sm outline-none focus:border-[var(--foreground)]"
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => run(async () => {
              await addOrgPost(orgId, text);
              setText("");
            })}
            className="self-end rounded-full bg-[var(--foreground)] px-4 py-1.5 text-xs font-medium text-[var(--background)] disabled:opacity-30"
          >
            Post
          </button>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
            <p className="mt-0.5 flex gap-3 text-xs text-[var(--muted)]">
              {formatDate(p.at)}
              {isAdmin && (
                <button type="button" className="underline" onClick={() => window.confirm("Delete this announcement?") && run(() => deleteOrgPost(p.id))}>
                  Delete
                </button>
              )}
            </p>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
