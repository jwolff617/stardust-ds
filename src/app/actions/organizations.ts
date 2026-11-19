"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Organizations: anyone can make one and write right away. Official comes
// only when a moderator approves.

export type OrgStatus = "unverified" | "applied" | "official";
export type Organization = { id: string; name: string; kind: string; website: string; about: string; status: OrgStatus };

const COLUMNS = "id, name, kind, website, about, status";

async function signedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in first.");
  return { supabase, user };
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// The organizations you run.
export async function myOrganizations(): Promise<Organization[]> {
  const { supabase, user } = await signedIn();
  const { data, error } = await supabase
    .from("organization_members")
    .select(`organization:organizations(${COLUMNS})`)
    .eq("user_id", user.id)
    .eq("role", "admin");
  fail(error);
  return (data ?? [])
    .map((m) => (Array.isArray(m.organization) ? m.organization[0] : m.organization) as Organization | null)
    .filter((o): o is Organization => Boolean(o))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type Fields = { name: string; kind: string; website: string; about: string };

export async function createOrganization(f: Fields) {
  const { supabase } = await signedIn();
  fail((await supabase.rpc("create_organization", { p_name: f.name, p_kind: f.kind, p_website: f.website, p_about: f.about })).error);
  revalidatePath("/");
}

export async function saveOrganization(id: string, f: Fields) {
  const { supabase } = await signedIn();
  fail((await supabase.rpc("save_organization", { p_id: id, p_name: f.name, p_kind: f.kind, p_website: f.website, p_about: f.about })).error);
  revalidatePath("/");
}

export async function deleteOrganization(id: string) {
  const { supabase } = await signedIn();
  fail((await supabase.rpc("delete_organization", { p_id: id })).error);
  revalidatePath("/");
}

export async function applyOfficial(id: string) {
  const { supabase } = await signedIn();
  fail((await supabase.rpc("apply_official", { p_id: id })).error);
  revalidatePath("/");
}

// For moderators: who's waiting, and who's Official now.
export async function officialQueue(): Promise<{ waiting: Organization[]; official: Organization[] }> {
  const { supabase } = await signedIn();
  const { data, error } = await supabase.from("organizations").select(COLUMNS).in("status", ["applied", "official"]).order("name");
  fail(error);
  const rows = (data ?? []) as Organization[];
  return { waiting: rows.filter((o) => o.status === "applied"), official: rows.filter((o) => o.status === "official") };
}

export async function reviewOrganization(id: string, approve: boolean) {
  const { supabase } = await signedIn();
  fail((await supabase.rpc("review_organization", { p_id: id, p_approve: approve })).error);
  revalidatePath("/");
}
