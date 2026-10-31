import { createClient } from "@/lib/supabase/server";

const FIELDS = ["tagline", "about", "highlights", "coming", "contact", "email", "link"] as const;

// One Business Page. ?dictionaryId
export async function GET(request: Request) {
  const dictionaryId = new URL(request.url).searchParams.get("dictionaryId") ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("dictionaries")
    .select("id, name, description, page, page_status, owner_user_id, display_kind")
    .eq("id", dictionaryId)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.display_kind !== "page") return Response.json({ error: "Page not found." }, { status: 404 });

  const { data: isModerator } = user ? await supabase.rpc("is_moderator") : { data: false };
  return Response.json({
    name: data.name,
    description: data.description ?? "",
    page: data.page ?? {},
    status: data.page_status ?? "draft",
    mine: Boolean(user && data.owner_user_id === user.id),
    isModerator: Boolean(isModerator),
  });
}

// { dictionaryId, action }
//   save { name, description, page }   apply   approve   sendBack
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.dictionaryId ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  let result;
  switch (body.action) {
    case "save": {
      const raw = body.page && typeof body.page === "object" ? (body.page as Record<string, unknown>) : {};
      const page: Record<string, string> = {};
      for (const f of FIELDS) {
        const v = String(raw[f] ?? "").trim().slice(0, 3000);
        if (v) page[f] = v;
      }
      if (page.link && !/^https?:\/\//.test(page.link)) page.link = `https://${page.link}`;
      result = await supabase.rpc("save_page", { p_id: id, p_name: String(body.name ?? ""), p_description: String(body.description ?? ""), p_page: page });
      break;
    }
    case "apply":
      result = await supabase.rpc("apply_official", { p_id: id });
      break;
    case "approve":
    case "sendBack":
      result = await supabase.rpc("review_page", { p_id: id, p_approve: body.action === "approve" });
      break;
    default:
      return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ ok: true });
}
