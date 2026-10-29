import { createClient } from "@/lib/supabase/server";
import { isAccountName } from "@/lib/accounts";

// Accounts DS Display View: every entry in the caller's Accounts instance,
// newest first. RLS keeps them owner-only.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_entries")
    .select("id, account, amount, note, created_at")
    .eq("dictionary_id", dictionaryId)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((row) => ({
    id: row.id,
    account: row.account,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at,
  }));

  return Response.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  // Quantity: a number or a word, up to 60 characters.
  const rawAmount = typeof body.amount === "string" || typeof body.amount === "number" ? String(body.amount).trim() || null : null;

  if (!dictionaryId || !isAccountName(body.account)) {
    return Response.json({ error: "dictionaryId and an account are required." }, { status: 400 });
  }
  if (rawAmount !== null && rawAmount.length > 60) {
    return Response.json({ error: "Quantity is 60 characters at most." }, { status: 400 });
  }
  if (rawAmount === null && !note) {
    return Response.json({ error: "An entry needs a quantity, a note, or both." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const { error } = await supabase.from("account_entries").insert({
    dictionary_id: dictionaryId,
    owner_user_id: user.id,
    account: body.account,
    amount: rawAmount,
    note,
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
