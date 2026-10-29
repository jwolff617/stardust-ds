import { createClient } from "@/lib/supabase/server";
import { loadExtras } from "@/lib/posts";

// One post's open comments and who's in. ?postId
export async function GET(request: Request) {
  const postId = new URL(request.url).searchParams.get("postId");
  if (!postId) return Response.json({ error: "postId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  try {
    return Response.json(await loadExtras(supabase, user.id, postId));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
