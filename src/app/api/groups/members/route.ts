import { createClient } from "@/lib/supabase/server";

// A group's members, owner first, and whether the caller owns the group.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dictionaryId = searchParams.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const { data, error } = await supabase.rpc("list_group_members", { p_dictionary_id: dictionaryId });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const members = (data ?? []).map((m: { user_id: string; name: string; role: string }) => ({
    userId: m.user_id,
    name: m.name,
    role: m.role,
    isMe: m.user_id === user.id,
  }));
  const isOwner = members.some((m: { isMe: boolean; role: string }) => m.isMe && m.role === "owner");

  return Response.json({ members, isOwner });
}

// Add a member by email ({ dictionaryId, email }) or remove one
// ({ dictionaryId, removeUserId }). Leaving is removing yourself.
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();

  const { error } = body.removeUserId
    ? await supabase.rpc("remove_group_member", { p_dictionary_id: dictionaryId, p_user_id: String(body.removeUserId) })
    : await supabase.rpc("add_group_member", { p_dictionary_id: dictionaryId, p_email: String(body.email ?? "") });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
