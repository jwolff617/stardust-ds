import { createClient } from "@/lib/supabase/server";
import { cleanLabels, cleanPost, loadBoard } from "@/lib/posts";

// A board's Display View: its kinds, posts, labels, and your reply threads.
// ?dictionaryId&kinds=a,b&labels=x,y&q=text&mine=1
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const dictionaryId = params.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });
  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in to see posts." }, { status: 401 });

  try {
    return Response.json(
      await loadBoard(supabase, user.id, dictionaryId, {
        kinds: list("kinds").slice(0, 20),
        labels: cleanLabels(list("labels")),
        q: (params.get("q") ?? "").slice(0, 100),
        mine: params.get("mine") === "1",
      }),
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

// { dictionaryId, action, ... }
//   add { post }            edit { id, post }        close / reopen / delete { id }
//   reply { id, body, replierId? }  (replierId: which thread, when it's your post)
//   report { id, reason }   block { id } (blocks the post's author)
export async function POST(request: Request) {
  const body = await request.json();
  const dictionaryId = String(body.dictionaryId ?? "");
  const id = String(body.id ?? "");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
  const done = (error: { message: string } | null) => (error ? fail(error.message) : Response.json({ ok: true }));

  switch (body.action) {
    case "add":
    case "edit": {
      const post = cleanPost(body.post ?? {});
      if (!post.title) return fail("Give your post a title.");
      if (!post.kind) return fail("Pick what kind of post it is.");
      if (body.action === "add") {
        const { error } = await supabase
          .from("posts")
          .insert({ ...post, dictionary_id: dictionaryId, author_user_id: user.id });
        return done(error);
      }
      const { error } = await supabase.from("posts").update(post).eq("id", id).eq("author_user_id", user.id);
      return done(error);
    }
    case "close":
    case "reopen": {
      const status = body.action === "close" ? "closed" : "open";
      const { error } = await supabase.from("posts").update({ status }).eq("id", id).eq("author_user_id", user.id);
      return done(error);
    }
    case "delete": {
      const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_user_id", user.id);
      return done(error);
    }
    case "reply": {
      const text = String(body.body ?? "").trim().slice(0, 2000);
      if (!text) return fail("Write a reply.");
      const { data: post } = await supabase.from("posts").select("author_user_id").eq("id", id).maybeSingle();
      if (!post) return fail("That post is gone.", 404);
      // Your own post: answer the thread you picked. Someone else's: your thread.
      const replierId = post.author_user_id === user.id ? String(body.replierId ?? "") : user.id;
      if (!replierId) return fail("Pick who you're answering.");
      const { error } = await supabase
        .from("post_replies")
        .insert({ post_id: id, replier_user_id: replierId, sender_user_id: user.id, body: text });
      return error ? fail("Couldn't send. If one of you blocked the other, replies are off.") : Response.json({ ok: true });
    }
    case "report": {
      const { error } = await supabase
        .from("post_reports")
        .insert({ post_id: id, reporter_user_id: user.id, reason: String(body.reason ?? "").slice(0, 500) });
      // Reporting twice is fine.
      if (error && error.code !== "23505") return fail(error.message);
      return Response.json({ ok: true });
    }
    case "block": {
      const { data: post } = await supabase.from("posts").select("author_user_id").eq("id", id).maybeSingle();
      const blocked = body.replierId ? String(body.replierId) : post?.author_user_id;
      if (!blocked || blocked === user.id) return fail("Nothing to block.");
      const { error } = await supabase.from("user_blocks").insert({ blocker_user_id: user.id, blocked_user_id: blocked });
      if (error && error.code !== "23505") return fail(error.message);
      return Response.json({ ok: true });
    }
    default:
      return fail("Unknown action.");
  }
}
