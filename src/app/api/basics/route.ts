import { createClient } from "@/lib/supabase/server";
import { basicApp } from "@/lib/basics";
import { addRecord, deleteRecord, editRecord, listRecords } from "@/lib/basics-db";

// The basic apps' Display Views (Notepad, Address Book, Birthdays): every
// record in the caller's copy, in the app's order. RLS keeps them owner-only.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  const app = basicApp(searchParams.get("kind"));
  if (!dictionaryId || !app) return Response.json({ error: "dictionaryId and a kind are required." }, { status: 400 });

  const supabase = await createClient();
  try {
    return Response.json({ items: await listRecords(supabase, app, dictionaryId) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

// { dictionaryId, kind, record } adds, or edits when record has an id.
// { dictionaryId, kind, deleteId } deletes.
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const app = basicApp(body.kind);
  if (!dictionaryId || !app) return Response.json({ error: "dictionaryId and a kind are required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  try {
    if (body.deleteId) {
      await deleteRecord(supabase, app, dictionaryId, String(body.deleteId));
      return Response.json({ ok: true });
    }
    const record = body.record ?? {};
    const item = record.id
      ? await editRecord(supabase, app, dictionaryId, String(record.id), record)
      : await addRecord(supabase, app, dictionaryId, user.id, record);
    return Response.json({ item });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
