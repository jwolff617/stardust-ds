import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoundWord, WordFields } from "@/lib/sage-ui";

// One search across everything a spark may see: dictionary words, notes,
// journals, listings, public profiles, organizations. Runs the
// stardust_search function (0046), which reads as the caller.

export type SearchQuery = { word?: string; body?: string } & WordFields;

const SPANS: Record<string, number> = {
  day: 1,
  week: 7,
  month: 31,
  year: 366,
  decade: 3653,
};

// "week" means made in the last week; "life" means any time. A date
// (2026-11-02) means that day; a month (2026-11) means that month.
export function timeRange(time: string | undefined, now = new Date()): { after: string | null; before: string | null } {
  const t = (time ?? "").trim().toLowerCase().replace(/^(this|last|past)\s+/, "");
  if (!t || t === "life" || t === "any" || t === "all") return { after: null, before: null };
  if (t === "today") return timeRange("day", now);
  if (SPANS[t]) return { after: new Date(now.getTime() - SPANS[t] * 86400000).toISOString(), before: null };
  const day = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) {
    const start = new Date(Date.UTC(+day[1], +day[2] - 1, +day[3]));
    return { after: start.toISOString(), before: new Date(start.getTime() + 86400000).toISOString() };
  }
  const month = t.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    return {
      after: new Date(Date.UTC(+month[1], +month[2] - 1, 1)).toISOString(),
      before: new Date(Date.UTC(+month[1], +month[2], 1)).toISOString(),
    };
  }
  const year = t.match(/^(\d{4})$/);
  if (year) {
    return { after: new Date(Date.UTC(+year[1], 0, 1)).toISOString(), before: new Date(Date.UTC(+year[1] + 1, 0, 1)).toISOString() };
  }
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return timeRange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, now);
  }
  return { after: null, before: null };
}

const VISIBILITY = ["private", "group", "public"];

export async function searchEverything(supabase: SupabaseClient, q: SearchQuery, limit = 30): Promise<FoundWord[]> {
  const { after, before } = timeRange(q.time);
  const visibility = (q.visibility ?? "").trim().toLowerCase();
  const { data, error } = await supabase.rpc("stardust_search", {
    p_word: (q.word ?? "").trim().slice(0, 120),
    p_body: (q.body ?? "").trim().slice(0, 300),
    p_place: (q.place ?? "").trim().slice(0, 120),
    p_people: (q.people ?? "").trim().slice(0, 120),
    p_after: after,
    p_before: before,
    p_visibility: VISIBILITY.includes(visibility) ? visibility : "",
    p_limit: limit,
  });
  if (error) {
    if (/stardust_search/.test(error.message)) throw new Error("Search needs migration 0046 first.");
    throw new Error(error.message);
  }
  type Row = { kind: string; id: string; word: string; body: string; place: string; people: string; visibility: string; created_at: string };
  return ((data ?? []) as Row[]).map((r) => ({
    kind: r.kind,
    id: r.id,
    word: r.word,
    body: r.body,
    place: r.place || undefined,
    people: r.people || undefined,
    visibility: r.visibility,
    time: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
    createdAt: r.created_at,
  }));
}
