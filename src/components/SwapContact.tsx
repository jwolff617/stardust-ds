"use client";

import { useEffect, useState } from "react";
import { getSwap, offerContact, withdrawContact, type Swap } from "@/app/actions/swaps";
import { input, link, primary } from "./ui";

// Under a private thread: offer your phone or email. The other person's
// shows only once you've both said yes.
export function SwapContact({ thread }: { thread: string }) {
  const [swap, setSwap] = useState<Swap | null>(null);
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    getSwap(thread).then(setSwap).catch(() => setSwap(null));
  }, [thread, token]);

  if (!swap) return null;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      setOpen(false);
      setToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (swap.mine && swap.theirs) {
    return (
      <p className="rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
        You both said yes. Theirs: <span className="font-medium select-all">{swap.theirs}</span> · Yours: {swap.mine}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs text-neutral-600">
      {swap.mine ? (
        <p>
          You offered {swap.mine}. They&apos;ll see it once they say yes too.{" "}
          <button type="button" onClick={() => run(() => withdrawContact(thread))} className={link}>
            Take it back
          </button>
        </p>
      ) : open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => offerContact(thread, contact));
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            autoFocus
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={120}
            placeholder="Your phone or email"
            aria-label="Your phone or email"
            className={`${input} min-w-0 flex-1`}
          />
          <button type="submit" disabled={contact.trim().length < 3} className={primary}>
            Say yes
          </button>
          <button type="button" onClick={() => setOpen(false)} className={link}>
            Cancel
          </button>
        </form>
      ) : (
        <p>
          {swap.theySaidYes && <span className="font-medium text-neutral-900">They want to swap numbers. </span>}
          <button type="button" onClick={() => setOpen(true)} className={link}>
            Swap phone numbers
          </button>{" "}
          <span className="text-neutral-400">Neither of you sees the other&apos;s until you both say yes.</span>
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
