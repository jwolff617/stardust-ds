import { createClient } from "@/lib/supabase/server";

// Display View for profile dictionaries. Owners see every field; anyone
// else signed in sees only public fields (RLS does the filtering).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryIds = (searchParams.get("dictionaryIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });
  if (dictionaryIds.length === 0) return Response.json({ items: [] });

  const { data, error } = await supabase
    .from("profile_fields")
    .select("id, dictionary_id, owner_user_id, name, value, visibility, position")
    .in("dictionary_id", dictionaryIds)
    .order("position", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((row) => ({
    id: row.id,
    dictionaryId: row.dictionary_id,
    name: row.name,
    value: row.value,
    visibility: row.visibility,
    mine: row.owner_user_id === user.id,
  }));

  return Response.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json();
  const fieldId = String(body.fieldId ?? "");
  const update: { value?: string; visibility?: string } = {};

  if (typeof body.value === "string") update.value = body.value.trim();
  if (body.visibility === "public" || body.visibility === "private") update.visibility = body.visibility;

  if (!fieldId || Object.keys(update).length === 0) {
    return Response.json({ error: "fieldId and a value or visibility are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profile_fields").update(update).eq("id", fieldId);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
