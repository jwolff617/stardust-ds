import { createClient } from "@/lib/supabase/server";
import { boardFor, cleanLabels, loadBoard, type BoardView } from "@/lib/posts";
import { closePost, deletePost, renewPost, reopenPost, savePost, type Result } from "@/lib/posts-db";
import { boardAction } from "@/lib/board-actions";

const VIEWS: BoardView[] = ["all", "mine", "saved", "inbox", "review"];
const REASONS = ["scam", "unsafe", "unfair", "spam", "sexual", "other"];

// A board's Display View: its kinds, posts, labels, your threads, and (for
// stewards) the review list.
// ?dictionaryId&view=all|mine|saved|inbox|review&kinds=a,b&labels=x,y&q=text&neighborhood=Ballard&sort=new|votes
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const dictionaryId = params.get("dictionaryId");
  if (!dictionaryId) return Response.json({ error: "dictionaryId is required." }, { status: 400 });
  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const view = VIEWS.find((v) => v === params.get("view")) ?? "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in to see posts." }, { status: 401 });

  try {
    return Response.json(
      await loadBoard(supabase, user.id, dictionaryId, {
        view,
        kinds: list("kinds").slice(0, 20),
        labels: cleanLabels(list("labels")),
        q: (params.get("q") ?? "").slice(0, 100),
        neighborhood: (params.get("neighborhood") ?? "").slice(0, 60),
        sort: params.get("sort") === "votes" ? "votes" : "new",
      }),
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

// { dictionaryId, action, ... }
//   add { post }    edit { id, post }    delete { id }    renew { id }    reopen { id }
//   close { id, note? }  (note goes to everyone who replied; empty sends none)
//   reply { id, body, replierId? }  (replierId: which thread, when it's your post)
//   report { id, reason, note }   reportThread { id, replierId?, reason, note }
//   block { id, replierId? } (the post's author, or a replier on your post)   unblock { userId }
//   save { id }   unsave { id }   confirmAdult { birthDate }
//   review { id, decision: clear|remove }   resolveThread { id, replierId }
//   Boards add their own actions in src/lib/board-actions.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
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
  const result = (r: Result) => (r.ok ? Response.json({ ok: true, id: r.id }) : fail(r.error, r.status));

  let config;
  try {
    config = await boardFor(supabase, dictionaryId);
  } catch (err) {
    return fail((err as Error).message, 404);
  }

  // A post on this board you can see, with the columns actions need.
  const findPost = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, author_user_id, kind, status, title")
      .eq("id", id)
      .eq("dictionary_id", dictionaryId)
      .maybeSingle();
    return data as { id: string; author_user_id: string; kind: string; status: string; title: string } | null;
  };

  switch (body.action) {
    case "add":
    case "edit":
      return result(await savePost(supabase, user.id, config, dictionaryId, body.post ?? {}, { id: body.action === "edit" ? id : undefined }));
    case "close":
      return result(await closePost(supabase, user.id, dictionaryId, id, String(body.note ?? "")));
    case "reopen":
      return result(await reopenPost(supabase, user.id, dictionaryId, id));
    case "renew":
      return result(await renewPost(supabase, user.id, dictionaryId, id));
    case "delete":
      return result(await deletePost(supabase, user.id, dictionaryId, id));
    case "reply": {
      const text = String(body.body ?? "").trim().slice(0, 2000);
      if (!text) return fail("Write a message first.");
      const post = await findPost();
      if (!post) return fail("That post is gone.", 404);
      // Your own post: answer the thread you picked. Someone else's: your thread.
      const replierId = post.author_user_id === user.id ? String(body.replierId ?? "") : user.id;
      if (!replierId) return fail("Pick who you're answering.");
      const { error } = await supabase
        .from("post_replies")
        .insert({ post_id: id, replier_user_id: replierId, sender_user_id: user.id, body: text });
      if (!error) return Response.json({ ok: true });
      if (/closed|messages this hour/.test(error.message)) return fail(error.message);
      return fail("Couldn't send. If one of you blocked the other, messages are off.");
    }
    case "report": {
      const reason = REASONS.includes(body.reason) ? body.reason : "other";
      const { error } = await supabase
        .from("post_reports")
        .insert({ post_id: id, reporter_user_id: user.id, reason, note: String(body.note ?? "").slice(0, 500) });
      // Reporting twice is fine.
      if (error && error.code !== "23505") return fail(error.message);
      return Response.json({ ok: true });
    }
    case "reportThread": {
      const post = await findPost();
      if (!post) return fail("That post is gone.", 404);
      const replierId = post.author_user_id === user.id ? String(body.replierId ?? "") : user.id;
      const other = post.author_user_id === user.id ? replierId : post.author_user_id;
      if (!replierId || other === user.id) return fail("Pick which thread.");
      const reason = REASONS.includes(body.reason) ? body.reason : "other";
      const { error } = await supabase.from("thread_reports").insert({
        post_id: id,
        replier_user_id: replierId,
        reporter_user_id: user.id,
        reason,
        note: String(body.note ?? "").slice(0, 500),
      });
      if (error && error.code !== "23505") return fail(error.message);
      // Reporting a thread blocks the other side too.
      const block = await supabase.from("user_blocks").insert({ blocker_user_id: user.id, blocked_user_id: other });
      if (block.error && block.error.code !== "23505") return fail(block.error.message);
      return Response.json({ ok: true });
    }
    case "block": {
      const post = await findPost();
      if (!post) return fail("That post is gone.", 404);
      const blocked = post.author_user_id === user.id ? String(body.replierId ?? "") : post.author_user_id;
      if (!blocked || blocked === user.id) return fail("Nothing to block.");
      const { error } = await supabase.from("user_blocks").insert({ blocker_user_id: user.id, blocked_user_id: blocked });
      if (error && error.code !== "23505") return fail(error.message);
      return Response.json({ ok: true });
    }
    case "unblock": {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_user_id", user.id)
        .eq("blocked_user_id", String(body.userId ?? ""));
      return done(error);
    }
    case "save": {
      const { error } = await supabase.from("post_saves").insert({ user_id: user.id, post_id: id });
      if (error && error.code !== "23505") return fail(error.message);
      return Response.json({ ok: true });
    }
    case "unsave": {
      const { error } = await supabase.from("post_saves").delete().eq("user_id", user.id).eq("post_id", id);
      return done(error);
    }
    case "confirmAdult": {
      // Only the yes is kept, never the birth date.
      const birth = String(body.birthDate ?? "");
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
      if (!m) return fail("Enter your birth date.");
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const today = new Date();
      let age = today.getFullYear() - y;
      if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
      if (y < 1900 || age > 120) return fail("Check your birth date.");
      if (age < 18) return fail("This part is for adults 18 and older.");
      if (body.agree !== true) return fail("Read and agree to the rules first.");
      const { error } = await supabase
        .from("board_confirmations")
        .insert({ dictionary_id: dictionaryId, user_id: user.id, adult_at: new Date().toISOString() });
      if (error && error.code !== "23505") return fail(error.message);
      return Response.json({ ok: true });
    }
    case "review": {
      const decision = body.decision === "clear" ? "clear" : body.decision === "remove" ? "remove" : null;
      if (!decision) return fail("Pick clear or remove.");
      const { error } = await supabase.rpc("review_post", { p_post_id: id, p_decision: decision });
      return done(error);
    }
    case "resolveThread": {
      const { error } = await supabase.rpc("resolve_thread_report", { p_post_id: id, p_replier_user_id: String(body.replierId ?? "") });
      return done(error);
    }
    default: {
      const result = await boardAction(supabase, user.id, config, dictionaryId, body);
      if (result) return result;
      return fail("Unknown action.");
    }
  }
}
