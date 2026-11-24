import { createClient } from "@/lib/supabase/server";
import { cleanPreferences } from "@/lib/preferences";
import { myNouns } from "@/lib/shortcuts";

// All of the spark's nouns, with opens, last opened, starred, and hotkey.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ nouns: [] });
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  const hotkeys = cleanPreferences(profile?.preferences ?? {}).hotkeys ?? {};
  return Response.json({ nouns: await myNouns(supabase, user.id, hotkeys) });
}

// { kind, id } counts an open; { kind, id, favorite } stars or unstars.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const kind = String(b.kind ?? "").slice(0, 20);
  const id = String(b.id ?? "");
  if (!kind || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ ok: false }, { status: 400 });
  const { error } =
    typeof b.favorite === "boolean"
      ? await supabase.rpc("star_noun", { p_kind: kind, p_ref: id, p_on: b.favorite })
      : await supabase.rpc("visit_noun", { p_kind: kind, p_ref: id });
  return Response.json({ ok: !error });
}
