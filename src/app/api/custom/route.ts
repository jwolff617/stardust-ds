import { createClient } from "@/lib/supabase/server";
import { createCustomDictionary, deleteCustomDictionary, deleteEntry, loadEntries, loadFields, saveEntry, type Result } from "@/lib/custom-db";

// A dictionary you built: its fields and entries. ?dictionaryId&q=text
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const dictionaryId = params.get("dictionaryId") ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const fields = await loadFields(supabase, dictionaryId);
  if (!fields) return Response.json({ error: "That isn't a dictionary you built." }, { status: 404 });
  try {
    return Response.json({ fields, entries: await loadEntries(supabase, dictionaryId, (params.get("q") ?? "").slice(0, 100)) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

// { action, ... }
//   create { name, description, fields }   deleteDictionary { dictionaryId }
//   add { dictionaryId, values, labels }   edit { dictionaryId, id, values, labels }   delete { dictionaryId, id }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const dictionaryId = String(body.dictionaryId ?? "");
  const id = String(body.id ?? "");
  const reply = (r: Result) => (r.ok ? Response.json({ ok: true, id: r.id }) : Response.json({ error: r.error }, { status: 400 }));

  switch (body.action) {
    case "create":
      return reply(await createCustomDictionary(supabase, String(body.name ?? ""), String(body.description ?? ""), body.fields));
    case "deleteDictionary":
      return reply(await deleteCustomDictionary(supabase, dictionaryId));
    case "add":
      return reply(await saveEntry(supabase, dictionaryId, body));
    case "edit":
      return reply(await saveEntry(supabase, dictionaryId, body, id));
    case "delete":
      return reply(await deleteEntry(supabase, dictionaryId, id));
    default:
      return Response.json({ error: "Unknown action." }, { status: 400 });
  }
}
