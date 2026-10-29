import type { SupabaseClient } from "@supabase/supabase-js";

// Idea House: the fund's public ledger (read from its Google Sheet, the
// same one urbanwolfstudio.net/idea-house reads) and judges' decisions.

export type Ledger = { headers: string[]; rows: string[][] };
export type Decision = { status: "reviewing" | "granted" | "not_this_time"; grantId: string; note: string; updatedAt: string };

// Minimal CSV parser: quoted fields, commas and doubled quotes inside them.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

// A second lock on privacy: the sheet lists grants by ID, and any column
// that looks like it holds a person is dropped anyway.
const PERSONAL = /name|applicant|email|e-mail|phone|address|contact/i;

export async function fetchLedger(url: string): Promise<Ledger> {
  if (!/^https:\/\/docs\.google\.com\//.test(url)) return { headers: [], rows: [] };
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { headers: [], rows: [] };
    const [headers = [], ...rows] = parseCsv(await res.text());
    const keep = headers.map((h, i) => (PERSONAL.test(h) ? -1 : i)).filter((i) => i >= 0);
    return { headers: keep.map((i) => headers[i]), rows: rows.slice(0, 500).map((r) => keep.map((i) => r[i] ?? "")) };
  } catch {
    return { headers: [], rows: [] };
  }
}

// The board's settings, the ledger, and the decisions on applications you
// can see (yours, or every one if you're a judge).
export async function loadIdeaHouse(supabase: SupabaseClient, dictionaryId: string) {
  const { data: board } = await supabase.from("post_boards").select("settings").eq("dictionary_id", dictionaryId).maybeSingle();
  const settings = (board?.settings ?? {}) as Record<string, unknown>;
  const [ledger, decisionsRes] = await Promise.all([
    fetchLedger(String(settings.ledgerCsv ?? "")),
    supabase.from("idea_house_decisions").select("post_id, status, grant_id, note, updated_at, posts!inner(dictionary_id)").eq("posts.dictionary_id", dictionaryId),
  ]);
  if (decisionsRes.error) throw new Error(decisionsRes.error.message);
  const decisions: Record<string, Decision> = {};
  for (const d of decisionsRes.data ?? []) {
    decisions[d.post_id] = { status: d.status, grantId: d.grant_id, note: d.note, updatedAt: d.updated_at };
  }
  return {
    ledger,
    decisions,
    nextReview: String(settings.nextReview ?? ""),
    publicPage: String(settings.publicPage ?? ""),
  };
}
