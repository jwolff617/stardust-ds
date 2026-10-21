import { createClient } from "@/lib/supabase/server";
import { expiresAtFor, isTimeFrame, normalizeNoteLabel, safeTimeZone } from "@/lib/time-frames";

// Inline edits on a note: its content, its label (empty clears it), or its
// time frame. A new time frame starts its life now.
export async function POST(request: Request) {
  const body = await request.json();
  const noteId = String(body.noteId ?? "");
  const update: Record<string, string | null> = {};

  if (typeof body.body === "string") {
    const content = body.body.trim();
    if (!content) return Response.json({ error: "A note needs content." }, { status: 400 });
    update.body = content;
  }
  if ("label" in body) update.label = normalizeNoteLabel(body.label);
  if (body.timeFrame !== undefined) {
    if (!isTimeFrame(body.timeFrame)) {
      return Response.json({ error: "Unknown time frame." }, { status: 400 });
    }
    update.time_frame = body.timeFrame;
    update.expires_at =
      expiresAtFor(body.timeFrame, new Date(), safeTimeZone(body.timeZone))?.toISOString() ?? null;
  }

  if (!noteId || Object.keys(update).length === 0) {
    return Response.json({ error: "noteId and something to change are required." }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("notes").update(update).eq("id", noteId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
