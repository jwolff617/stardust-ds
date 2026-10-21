import { createClient } from "@/lib/supabase/server";
import { BET_OUTCOMES, PRINCIPLES, WORTHY_KINDS, type BetOutcome, type Principle, type WorthyKind } from "@/lib/worthy";

// Worthy DS Display View: every money entry and bet story in the caller's
// Worthy instance. The page sums them per range (see lib/worthy.ts).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const [entries, stories] = await Promise.all([
    supabase
      .from("worthy_entries")
      .select("id, kind, amount, note, occurred_at")
      .eq("dictionary_id", dictionaryId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("bet_stories")
      .select("id, occurred_on, outcome, body, principles")
      .eq("dictionary_id", dictionaryId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (entries.error) return Response.json({ error: entries.error.message }, { status: 500 });
  if (stories.error) return Response.json({ error: stories.error.message }, { status: 500 });

  return Response.json({
    entries: (entries.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      amount: Number(row.amount),
      note: row.note,
      occurredAt: row.occurred_at,
    })),
    stories: (stories.data ?? []).map((row) => ({
      id: row.id,
      occurredOn: row.occurred_on,
      outcome: row.outcome,
      body: row.body,
      principles: row.principles ?? [],
    })),
  });
}

// Adds a money entry ({ type: "entry", kind, amount, note?, occurredAt? })
// or a bet story ({ type: "story", occurredOn, outcome, body, principles }).
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  if (body.type === "story") {
    const text = String(body.body ?? "").trim();
    const outcome = body.outcome as BetOutcome;
    const occurredOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.occurredOn ?? "")) ? body.occurredOn : null;
    const principles = (Array.isArray(body.principles) ? body.principles : []).filter((p: unknown) =>
      PRINCIPLES.includes(p as Principle),
    );
    if (!text || !BET_OUTCOMES.includes(outcome)) {
      return Response.json({ error: "A bet story needs an outcome and some words." }, { status: 400 });
    }

    const { error } = await supabase.from("bet_stories").insert({
      dictionary_id: dictionaryId,
      owner_user_id: user.id,
      outcome,
      body: text,
      principles,
      ...(occurredOn ? { occurred_on: occurredOn } : {}),
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  const kind = body.kind as WorthyKind;
  const amount = Number(body.amount);
  const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
  if (!WORTHY_KINDS.includes(kind) || !Number.isFinite(amount) || amount < 0) {
    return Response.json({ error: "An entry needs a type and an amount of zero or more." }, { status: 400 });
  }
  if (Number.isNaN(occurredAt.getTime())) {
    return Response.json({ error: "That date doesn't look right." }, { status: 400 });
  }

  const { error } = await supabase.from("worthy_entries").insert({
    dictionary_id: dictionaryId,
    owner_user_id: user.id,
    kind,
    amount,
    note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    occurred_at: occurredAt.toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
