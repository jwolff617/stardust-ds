import { createClient } from "@/lib/supabase/server";
import { cleanThemes, generatePacket } from "@/lib/wolffie/packet";
import { AGES } from "@/lib/wolffie/shared";

// Wolffie Games Display View: your saved themes and past packets.
export async function GET(request: Request) {
  const dictionaryId = new URL(request.url).searchParams.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const [themes, packets] = await Promise.all([
    supabase.from("wolffie_themes").select("id, name").eq("dictionary_id", dictionaryId).order("name"),
    supabase
      .from("wolffie_packets")
      .select("id, themes, kids, age, content->>title, created_at")
      .eq("dictionary_id", dictionaryId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const error = themes.error ?? packets.error;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    themes: themes.data ?? [],
    packets: (packets.data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      themes: p.themes,
      kids: p.kids,
      age: p.age,
      createdAt: p.created_at,
    })),
  });
}

// { dictionaryId, action: "generate", themes, kids, age } writes a packet.
// { dictionaryId, action: "addTheme", name } / "deleteTheme" / "deletePacket" with id.
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const owned = { dictionary_id: dictionaryId, owner_user_id: user.id };

  switch (body.action) {
    case "generate": {
      const themes = cleanThemes(body.themes);
      const kids = Math.round(Number(body.kids));
      const age = Math.round(Number(body.age));
      if (themes.length === 0) return Response.json({ error: "Pick or type a theme." }, { status: 400 });
      if (!(kids >= 1 && kids <= 200)) return Response.json({ error: "Number of kids is 1 to 200." }, { status: 400 });
      if (!(age >= AGES.min && age <= AGES.max)) {
        return Response.json({ error: `Age is ${AGES.min} to ${AGES.max}.` }, { status: 400 });
      }
      try {
        const content = await generatePacket(themes, kids, age);
        const { data, error } = await supabase
          .from("wolffie_packets")
          .insert({ ...owned, themes, kids, age, content })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return Response.json({ id: data.id });
      } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 500 });
      }
    }
    case "addTheme": {
      const [name] = cleanThemes([body.name]);
      if (!name) return Response.json({ error: "Type a theme." }, { status: 400 });
      const { error } = await supabase.from("wolffie_themes").insert({ ...owned, name });
      // Already saved is fine.
      if (error && error.code !== "23505") return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ ok: true });
    }
    case "deleteTheme":
    case "deletePacket": {
      const table = body.action === "deleteTheme" ? "wolffie_themes" : "wolffie_packets";
      const { error } = await supabase.from(table).delete().eq("id", String(body.id ?? "")).eq("dictionary_id", dictionaryId);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ error: "Unknown action." }, { status: 400 });
  }
}
