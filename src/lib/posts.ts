import type { SupabaseClient } from "@supabase/supabase-js";

// Posts: the one shared piece under every board (Marketplace first). Each
// board names its own kinds of post in post_kinds. RLS hides posts from
// sparks who blocked each other and posts with three reports.

export type PostKind = { name: string; description: string };

export type Post = {
  id: string;
  kind: string;
  title: string;
  body: string;
  neighborhood: string;
  price: string;
  labels: string[];
  status: "open" | "closed";
  authorName: string;
  mine: boolean;
  hidden: boolean;
  createdAt: string;
  // Your private threads on this post: one if you replied, one per replier if it's yours.
  threads: Thread[];
};

export type Reply = { id: string; mine: boolean; senderName: string; body: string; createdAt: string };
export type Thread = { replierId: string; replierName: string; replies: Reply[] };

const COLUMNS = "id, kind, title, body, neighborhood, price, labels, status, author_user_id, author_name, hidden_at, created_at";

export function cleanLabels(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(",");
  const out = new Set<string>();
  for (const l of raw) {
    const label = String(l ?? "").trim().toLowerCase().replace(/^#/, "").slice(0, 30);
    if (label) out.add(label);
  }
  return [...out].slice(0, 10);
}

export async function loadBoard(
  supabase: SupabaseClient,
  userId: string,
  dictionaryId: string,
  filters: { kinds: string[]; labels: string[]; q: string; mine: boolean },
) {
  const kindsQuery = supabase.from("post_kinds").select("name, description").eq("dictionary_id", dictionaryId).order("position");

  let q = supabase.from("posts").select(COLUMNS).eq("dictionary_id", dictionaryId).order("created_at", { ascending: false });
  if (filters.kinds.length > 0) q = q.in("kind", filters.kinds);
  if (filters.labels.length > 0) q = q.overlaps("labels", filters.labels);
  if (filters.mine) q = q.eq("author_user_id", userId);
  else q = q.eq("status", "open");
  const text = filters.q.trim().replace(/[%,()]/g, " ");
  if (text) q = q.or(`title.ilike.%${text}%,body.ilike.%${text}%,neighborhood.ilike.%${text}%`);

  const [kinds, posts] = await Promise.all([kindsQuery, q.limit(200)]);
  if (kinds.error) throw new Error(kinds.error.message);
  if (posts.error) throw new Error(posts.error.message);

  const rows = posts.data ?? [];
  const ids = rows.map((r) => r.id);
  const replies = ids.length
    ? await supabase
        .from("post_replies")
        .select("id, post_id, replier_user_id, sender_user_id, sender_name, body, created_at")
        .in("post_id", ids)
        .order("created_at")
    : { data: [], error: null };
  if (replies.error) throw new Error(replies.error.message);
  const replyRows = (replies.data ?? []) as {
    id: string;
    post_id: string;
    replier_user_id: string;
    sender_user_id: string;
    sender_name: string;
    body: string;
    created_at: string;
  }[];

  // Labels across the whole board, most used first, for the filter chips.
  const counts = new Map<string, number>();
  for (const r of rows) for (const l of r.labels ?? []) counts.set(l, (counts.get(l) ?? 0) + 1);

  return {
    kinds: (kinds.data ?? []) as PostKind[],
    labels: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, 20),
    posts: rows.map((r): Post => {
      const threads = new Map<string, Thread>();
      for (const rep of replyRows.filter((x) => x.post_id === r.id)) {
        const t = threads.get(rep.replier_user_id) ?? { replierId: rep.replier_user_id, replierName: "", replies: [] };
        if (rep.sender_user_id === rep.replier_user_id) t.replierName = rep.sender_name;
        t.replies.push({
          id: rep.id,
          mine: rep.sender_user_id === userId,
          senderName: rep.sender_name,
          body: rep.body,
          createdAt: rep.created_at,
        });
        threads.set(rep.replier_user_id, t);
      }
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        neighborhood: r.neighborhood,
        price: r.price,
        labels: r.labels ?? [],
        status: r.status,
        authorName: r.author_name || "A Stardust spark",
        mine: r.author_user_id === userId,
        hidden: r.hidden_at !== null,
        createdAt: r.created_at,
        threads: [...threads.values()],
      };
    }),
  };
}

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function cleanPost(input: Record<string, unknown>) {
  return {
    kind: text(input.kind, 40),
    title: text(input.title, 120),
    body: text(input.body, 5000),
    neighborhood: text(input.neighborhood, 60),
    price: text(input.price, 40),
    labels: cleanLabels(input.labels),
  };
}
