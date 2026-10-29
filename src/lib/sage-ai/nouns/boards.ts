import { BOARDS, type BoardConfig } from "@/lib/boards";
import { loadBoard } from "@/lib/posts";
import { closePost, deletePost, renewPost, reopenPost, savePost, type Result } from "@/lib/posts-db";
import type { Field, NounDef, VerbResult } from "../engine";

// One noun per board on Posts (Listing, Job Post, Idea, ...), made from the
// same config as the board's form. Sage AI posts and manages your own
// posts and finds others'. Replying, reporting, and blocking stay with the
// person.

const toVerb = (r: Result, message: string): VerbResult => (r.ok ? { ok: true, message, data: r.id ? { id: r.id } : undefined } : { ok: false, error: r.error });

// Each kind's own fields, as params. Keys are shared across kinds where the
// meaning matches; the notes say which kind uses which.
function detailParams(board: BoardConfig): Field[] {
  const seen = new Map<string, Field>();
  for (const kind of board.kinds) {
    for (const f of kind.fields) {
      if (f.type === "lines" || seen.has(f.key)) continue;
      const options = f.type === "choice" ? ` One of: ${f.options?.join(", ")}.` : "";
      seen.set(f.key, { name: f.key, type: "text", max: f.max ?? 2000, description: `${f.label} (${kind.name}).${options}` });
    }
  }
  return [...seen.values()];
}

function baseParams(board: BoardConfig, required: boolean): Field[] {
  const money = board.kinds.filter((k) => k.price).map((k) => `${k.price!.label} for ${k.name}${k.price!.required ? " (required)" : ""}`);
  return [
    { name: "kind", type: "enum", options: board.kinds.map((k) => k.name), required },
    { name: "title", type: "text", max: 120, required },
    { name: "body", type: "text", max: 5000, description: "The details." },
    ...(money.length ? [{ name: "price", type: "text" as const, max: 60, description: `The money line: ${money.join("; ")}.` }] : []),
    { name: "neighborhood", type: "text", max: 60, description: "A Seattle neighborhood." },
    { name: "labels", type: "text", max: 300, description: `Comma-separated short labels for search. Suggested: ${board.labels.slice(0, 12).join(", ")}.` },
    ...detailParams(board),
  ];
}

function splitValues(board: BoardConfig, values: Record<string, unknown>) {
  const detailKeys = new Set(board.kinds.flatMap((k) => k.fields.map((f) => f.key)));
  const details: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) (detailKeys.has(k) ? details : rest)[k] = v;
  return { ...rest, details };
}

export function boardNoun(board: BoardConfig): NounDef {
  const what = board.noun.toLowerCase();
  const target = `the ${what}'s id from Find (your own)`;
  return {
    name: board.noun,
    dictionary: board.address,
    description: board.nounDescription,
    notes:
      "Only Add, Edit, Archive, Restore, Delete, and Renew your own posts. Each kind takes only its own fields; Find shows what's there. " +
      "If a post's wording would turn people away (fair housing, fair hiring), the tool says why: reword it, never argue.",
    verbs: {
      Add: {
        params: baseParams(board, true),
        run: async ({ ctx, dictionary, values }) =>
          toVerb(await savePost(ctx.supabase, ctx.userId, board, dictionary!.id, splitValues(board, values), { strict: true }), `Posted "${values.title}".`),
      },
      Edit: {
        description: "Changes only the fields given.",
        target,
        params: baseParams(board, false),
        run: async ({ ctx, dictionary, target: id, values }) => {
          const { data: current } = await ctx.supabase
            .from("posts")
            .select("kind, title, body, price, neighborhood, labels, details, photos, organization_id")
            .eq("id", id!)
            .eq("author_user_id", ctx.userId)
            .maybeSingle();
          if (!current) return { ok: false, error: `No post of yours with id ${id}. Find it first.` };
          const split = splitValues(board, values) as Record<string, unknown> & { details: Record<string, unknown> };
          const merged = {
            ...current,
            organizationId: current.organization_id,
            ...split,
            details: { ...(current.details ?? {}), ...split.details },
          };
          return toVerb(await savePost(ctx.supabase, ctx.userId, board, dictionary!.id, merged, { id: id!, strict: true }), "Updated the post.");
        },
      },
      Find: {
        description: "Open posts on the board, newest first, or your own (mine = yes), with ids.",
        params: [
          { name: "kind", type: "enum", options: board.kinds.map((k) => k.name) },
          { name: "query", type: "text", max: 100 },
          { name: "label", type: "text", max: 30 },
          { name: "mine", type: "enum", options: ["yes", "no"] },
        ],
        run: async ({ ctx, dictionary, values }) => {
          const result = await loadBoard(ctx.supabase, ctx.userId, dictionary!.id, {
            view: values.mine === "yes" ? "mine" : "all",
            kinds: values.kind ? [values.kind as string] : [],
            labels: values.label ? [String(values.label).toLowerCase()] : [],
            q: String(values.query ?? ""),
            neighborhood: "",
            sort: "new",
          });
          return {
            ok: true,
            message: `Found ${result.posts.length} post${result.posts.length === 1 ? "" : "s"}.`,
            data: result.posts.slice(0, 30).map((p) => ({
              id: p.id,
              kind: p.kind,
              title: p.title,
              price: p.price || undefined,
              neighborhood: p.neighborhood || undefined,
              by: p.mine ? "you" : p.organization?.name ?? p.authorName,
              labels: p.labels,
              details: p.details,
              status: p.status,
              expired: p.expired || undefined,
              posted: p.createdAt.slice(0, 10),
              body: p.body.slice(0, 300),
            })),
          };
        },
      },
      Archive: {
        description: "Mark your post closed (sold, given, filled). Everyone who wrote gets a short thank-you note.",
        target,
        run: async ({ ctx, dictionary, target: id }) => {
          const { data } = await ctx.supabase.from("posts").select("kind").eq("id", id!).maybeSingle();
          const note = board.kinds.find((k) => k.name === data?.kind)?.close.note ?? "";
          return toVerb(await closePost(ctx.supabase, ctx.userId, dictionary!.id, id!, note), "Closed it, and let everyone who wrote know.");
        },
      },
      Restore: {
        description: "Reopen your closed post.",
        target,
        run: async ({ ctx, dictionary, target: id }) => toVerb(await reopenPost(ctx.supabase, ctx.userId, dictionary!.id, id!), "Reopened it."),
      },
      Delete: {
        target,
        run: async ({ ctx, dictionary, target: id }) => toVerb(await deletePost(ctx.supabase, ctx.userId, dictionary!.id, id!), "Deleted the post."),
      },
    },
    actions: {
      Renew: {
        description: "Keep your post up longer: restarts its clock from today.",
        target,
        run: async ({ ctx, dictionary, target: id }) => toVerb(await renewPost(ctx.supabase, ctx.userId, dictionary!.id, id!), "Renewed it."),
      },
    },
  };
}

export const boardNouns: NounDef[] = BOARDS.filter((b) => b.sageAi !== false).map(boardNoun);
