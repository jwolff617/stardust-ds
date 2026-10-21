import { createClient } from "@/lib/supabase/server";
import { expiresAtFor, isTimeFrame, safeTimeZone } from "@/lib/time-frames";

// Brings a note back from Archived or Done with a fresh time frame, whose
// life starts now.
export async function POST(request: Request) {
  const body = await request.json();
  const noteId = String(body.noteId ?? "");

  if (!noteId || !isTimeFrame(body.timeFrame)) {
    return Response.json({ error: "noteId and a time frame are required." }, { status: 400 });
  }

  const expiresAt = expiresAtFor(body.timeFrame, new Date(), safeTimeZone(body.timeZone));

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_note", {
    p_note_id: noteId,
    p_time_frame: body.timeFrame,
    p_expires_at: expiresAt?.toISOString() ?? null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
