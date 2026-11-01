import { createClient } from "@/lib/supabase/server";

// The daily schedule: rows of time, activity, and notes. RLS keeps it to
// group members.
export async function GET(request: Request) {
  const dictionaryId = new URL(request.url).searchParams.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("after_school_schedule")
    .select("id, time, activity, notes, position")
    .eq("dictionary_id", dictionaryId)
    .order("position")
    .order("updated_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

// { dictionaryId, action }
//   add { afterId? }   save { id, time, activity, notes }   delete { id }   move { ids } (the new order)
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const dictionaryId = String(body.dictionaryId ?? "");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const text = (v: unknown, max: number) => String(v ?? "").slice(0, max);
  let error: { message: string } | null = null;

  switch (body.action) {
    case "add": {
      const { count } = await supabase.from("after_school_schedule").select("id", { count: "exact", head: true }).eq("dictionary_id", dictionaryId);
      if ((count ?? 0) >= 60) return Response.json({ error: "A schedule holds 60 rows." }, { status: 400 });
      ({ error } = await supabase
        .from("after_school_schedule")
        .insert({ dictionary_id: dictionaryId, position: (count ?? 0) + 1, updated_by: user.id }));
      break;
    }
    case "save":
      ({ error } = await supabase
        .from("after_school_schedule")
        .update({
          time: text(body.time, 40),
          activity: text(body.activity, 200),
          notes: text(body.notes, 2000),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", String(body.id ?? ""))
        .eq("dictionary_id", dictionaryId));
      break;
    case "delete":
      ({ error } = await supabase.from("after_school_schedule").delete().eq("id", String(body.id ?? "")).eq("dictionary_id", dictionaryId));
      break;
    case "move": {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 60) : [];
      for (const [i, id] of ids.entries()) {
        const r = await supabase.from("after_school_schedule").update({ position: i + 1 }).eq("id", id).eq("dictionary_id", dictionaryId);
        if (r.error) {
          error = r.error;
          break;
        }
      }
      break;
    }
    default:
      return Response.json({ error: "Unknown action." }, { status: 400 });
  }

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
