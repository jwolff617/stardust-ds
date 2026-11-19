"use server";

import { createClient } from "@/lib/supabase/server";

// Swap phones: each person in a private thread can offer a phone or email.
// Neither sees the other's until both have said yes. thread is
// "d:<listing>:<asker>" or "p:<post>:<replier>".

export type Swap = { mine: string | null; theySaidYes: boolean; theirs: string | null };

async function signedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in first.");
  return supabase;
}

export async function getSwap(thread: string): Promise<Swap> {
  const supabase = await signedIn();
  const { data, error } = await supabase.rpc("contact_swap", { p_thread: thread });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as { mine: string | null; they_said_yes: boolean; theirs: string | null } | undefined;
  return { mine: row?.mine ?? null, theySaidYes: Boolean(row?.they_said_yes), theirs: row?.theirs ?? null };
}

export async function offerContact(thread: string, contact: string) {
  const supabase = await signedIn();
  const { error } = await supabase.rpc("offer_contact", { p_thread: thread, p_contact: contact });
  if (error) throw new Error(error.message);
}

export async function withdrawContact(thread: string) {
  const supabase = await signedIn();
  const { error } = await supabase.rpc("withdraw_contact", { p_thread: thread });
  if (error) throw new Error(error.message);
}
