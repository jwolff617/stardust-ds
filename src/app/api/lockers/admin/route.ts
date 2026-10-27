import { createClient } from "@/lib/supabase/server";
import { daysAgo, isIsoDate } from "@/lib/lockers";
import { loadAdmin, saveBar, saveLocker, saveParticipant, setAttendance } from "@/lib/lockers-db";

// Everything in a Lockers Admin group: participants, lockers, bars, and
// attendance from `since` (default 30 days ago) on. RLS keeps it to members.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  const since = searchParams.get("since");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  try {
    return Response.json(await loadAdmin(supabase, dictionaryId, isIsoDate(since) ? since : daysAgo(30)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

const ACTIONS = {
  participant: saveParticipant,
  locker: saveLocker,
  bar: saveBar,
  attendance: setAttendance,
};

// { dictionaryId, action, record }: action is participant, locker, bar, or
// attendance, and record is what to save.
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const save = ACTIONS[body.action as keyof typeof ACTIONS];
  if (!dictionaryId || !save) {
    return Response.json({ error: "dictionaryId and an action (participant, locker, bar, attendance) are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  try {
    await save(supabase, dictionaryId, user.id, body.record ?? {});
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
