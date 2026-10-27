import { createClient } from "@/lib/supabase/server";
import { deletePost, loadPosts, savePost } from "@/lib/lockers-db";

// The public Lockers page: hours, rules, and announcements, plus whether
// the caller is a Lockers admin who can edit them.
export async function GET() {
  const supabase = await createClient();
  try {
    return Response.json(await loadPosts(supabase));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

// { kind, body, id? } saves; { deleteId } deletes an announcement. RLS
// refuses anyone outside the admin group.
export async function POST(request: Request) {
  const body = await request.json();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  try {
    if (body.deleteId) {
      await deletePost(supabase, String(body.deleteId));
    } else {
      if (!["hours", "rules", "announcement"].includes(body.kind)) {
        return Response.json({ error: "kind must be hours, rules, or announcement." }, { status: 400 });
      }
      await savePost(supabase, user.id, { id: body.id ? String(body.id) : undefined, kind: body.kind, body: body.body });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
