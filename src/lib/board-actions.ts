import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardConfig } from "./boards";

const REASONS = ["scam", "unsafe", "unfair", "spam", "sexual", "other"];

// Actions one board adds on top of the shared Posts ones. The database
// checks each board has the feature on (board_has); these just send.
// Returns null when the action isn't one of these.
//   spark / unspark { id }
//   comment { id, body, parentId? }   deleteComment { commentId }
//   reportComment { commentId, reason, note }   reviewComment { commentId, decision }
//   join { id, offer }   leave { id }   removeJoin { id, userId } (your post)
//   Idea House adds decide (see idea-house.ts).
export async function boardAction(
  supabase: SupabaseClient,
  userId: string,
  config: BoardConfig,
  dictionaryId: string,
  body: Record<string, unknown>,
): Promise<Response | null> {
  void config;
  void dictionaryId;
  const id = String(body.id ?? "");
  const commentId = String(body.commentId ?? "");
  const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
  const ok = () => Response.json({ ok: true });
  const dupeOk = (error: { code?: string; message: string } | null) => (error && error.code !== "23505" ? fail(error.message) : ok());

  switch (body.action) {
    case "spark": {
      const { error } = await supabase.from("post_votes").insert({ post_id: id, user_id: userId });
      if (error && error.code === "42501") return fail("You can't spark your own post.");
      return dupeOk(error);
    }
    case "unspark": {
      const { error } = await supabase.from("post_votes").delete().eq("post_id", id).eq("user_id", userId);
      return error ? fail(error.message) : ok();
    }
    case "comment": {
      const text = String(body.body ?? "").trim().slice(0, 2000);
      if (!text) return fail("Write something first.");
      const parentId = body.parentId ? String(body.parentId) : null;
      const { error } = await supabase.from("post_comments").insert({ post_id: id, parent_id: parentId, author_user_id: userId, body: text });
      return error ? fail(error.code === "42501" ? "Comments are off for you on this post." : error.message) : ok();
    }
    case "deleteComment": {
      const { error } = await supabase.from("post_comments").delete().eq("id", commentId).eq("author_user_id", userId);
      return error ? fail(error.message) : ok();
    }
    case "reportComment": {
      const reason = REASONS.includes(String(body.reason)) ? String(body.reason) : "other";
      const { error } = await supabase
        .from("comment_reports")
        .insert({ comment_id: commentId, reporter_user_id: userId, reason, note: String(body.note ?? "").slice(0, 500) });
      return dupeOk(error);
    }
    case "reviewComment": {
      const decision = body.decision === "clear" ? "clear" : "remove";
      const { error } = await supabase.rpc("review_comment", { p_comment_id: commentId, p_decision: decision });
      return error ? fail(error.message) : ok();
    }
    case "join": {
      const offer = String(body.offer ?? "").trim().slice(0, 200);
      const { error } = await supabase.from("post_joins").insert({ post_id: id, user_id: userId, offer });
      if (error?.code === "23505") {
        const { error: e2 } = await supabase.from("post_joins").update({ offer }).eq("post_id", id).eq("user_id", userId);
        return e2 ? fail(e2.message) : ok();
      }
      if (error && error.code === "42501") return fail("You can't join your own post.");
      return error ? fail(error.message) : ok();
    }
    case "leave": {
      const { error } = await supabase.from("post_joins").delete().eq("post_id", id).eq("user_id", userId);
      return error ? fail(error.message) : ok();
    }
    case "removeJoin": {
      const { error } = await supabase.from("post_joins").delete().eq("post_id", id).eq("user_id", String(body.userId ?? ""));
      return error ? fail(error.message) : ok();
    }
    default:
      return null;
  }
}
