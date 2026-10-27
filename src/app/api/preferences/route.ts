import { createClient } from "@/lib/supabase/server";
import { cleanPreferences } from "@/lib/preferences";

// The caller's saved arrangement. Before the preferences column exists this
// returns nothing and the app runs on its browser copy.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ preferences: null });

  const { data, error } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  if (error || !data?.preferences || Object.keys(data.preferences).length === 0) {
    return Response.json({ preferences: null });
  }
  return Response.json({ preferences: cleanPreferences(data.preferences) });
}

// Replaces the caller's saved arrangement.
export async function POST(request: Request) {
  const body = await request.json();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: cleanPreferences(body.preferences) })
    .eq("id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
