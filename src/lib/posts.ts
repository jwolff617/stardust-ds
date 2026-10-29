import type { SupabaseClient } from "@supabase/supabase-js";
import { boardByAddress, cleanDetails, kindOf, type BoardConfig } from "./boards";

// Posts: the one shared piece under every board. Each board names its own
// kinds in post_kinds and its fields in src/lib/boards.ts. RLS hides posts
// from sparks who blocked each other, hidden posts, steward-only kinds,
// and 18+ kinds until you confirm.

export const PHOTO_BUCKET = "post-photos";

export type PostKind = {
  name: string;
  description: string;
  expiresDays: number | null;
  adultOnly: boolean;
  onePerPerson: boolean;
  stewardsOnly: boolean;
  mutual: boolean;
  open: boolean;
};

export type Reply = { id: string; mine: boolean; senderName: string; body: string; createdAt: string };
export type Thread = {
  replierId: string;
  replierName: string;
  replies: Reply[];
  // The last message is theirs, so it's your turn.
  yourTurn: boolean;
};

export type Post = {
  id: string;
  kind: string;
  title: string;
  body: string;
  neighborhood: string;
  price: string;
  labels: string[];
  details: Record<string, unknown>;
  photos: { path: string; url: string }[];
  status: "open" | "closed";
  authorName: string;
  organization: { id: string; name: string; verified: boolean } | null;
  mine: boolean;
  hidden: boolean;
  review: "cleared" | "removed" | null;
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
  saved: boolean;
  // You sparked it (boards with votes).
  voted: boolean;
  voteCount: number;
  commentCount: number;
  joinCount: number;
  // Your private threads on this post: one if you replied, one per replier if it's yours.
  threads: Thread[];
};

export type BoardView = "all" | "mine" | "saved" | "inbox" | "review";

export type ReviewItem = {
  post: Post;
  reports: { reason: string; note: string; createdAt: string }[];
};
export type ThreadReview = {
  postId: string;
  postTitle: string;
  replierId: string;
  reasons: string[];
  notes: string[];
  replies: Reply[];
};

export type Board = {
  address: string;
  intro: string;
  settings: Record<string, unknown>;
  kinds: PostKind[];
  labels: string[];
  neighborhoods: string[];
  posts: Post[];
  waiting: number;
  // Your open posts here, for "Matches yours".
  mineOpen: { id: string; kind: string; title: string; labels: string[]; details: Record<string, unknown> }[];
  me: {
    userId: string;
    isSteward: boolean;
    adultConfirmed: boolean;
    organizations: { id: string; name: string; verified: boolean }[];
    blocked: { userId: string; name: string }[];
  };
  review: { posts: ReviewItem[]; threads: ThreadReview[]; comments: CommentReview[] } | null;
};

export type Comment = {
  id: string;
  parentId: string | null;
  authorName: string;
  mine: boolean;
  body: string;
  hidden: boolean;
  createdAt: string;
};
export type Join = { userId: string; name: string; offer: string; mine: boolean };
export type CommentReview = { comment: Comment; postId: string; postTitle: string; reports: { reason: string; note: string }[] };

export type BoardFilters = {
  view: BoardView;
  kinds: string[];
  labels: string[];
  q: string;
  neighborhood: string;
  sort: "new" | "votes";
};

const COLUMNS =
  "id, dictionary_id, kind, title, body, neighborhood, price, labels, details, photos, status, author_user_id, author_name, " +
  "organization_id, vote_count, comment_count, join_count, hidden_at, review, expires_at, created_at";

type PostRow = {
  id: string;
  dictionary_id: string;
  kind: string;
  title: string;
  body: string;
  neighborhood: string;
  price: string;
  labels: string[] | null;
  details: Record<string, unknown> | null;
  photos: string[] | null;
  status: "open" | "closed";
  author_user_id: string;
  author_name: string;
  organization_id: string | null;
  vote_count: number;
  comment_count: number;
  join_count: number;
  hidden_at: string | null;
  review: "cleared" | "removed" | null;
  // "infinity" for kinds that never expire.
  expires_at: string;
  created_at: string;
};

const neverExpires = (at: string) => at === "infinity" || at.startsWith("9999") || at === "";

type ReplyRow = {
  id: string;
  post_id: string;
  replier_user_id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export function cleanLabels(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(",");
  const out = new Set<string>();
  for (const l of raw) {
    const label = String(l ?? "").trim().toLowerCase().replace(/^#/, "").slice(0, 30);
    if (label) out.add(label);
  }
  return [...out].slice(0, 10);
}

// The board a dictionary id points to, with its code config.
export async function boardFor(supabase: SupabaseClient, dictionaryId: string): Promise<BoardConfig> {
  const { data, error } = await supabase.from("dictionaries").select("address").eq("id", dictionaryId).maybeSingle();
  if (error) throw new Error(error.message);
  const config = data && boardByAddress(data.address);
  if (!config) throw new Error("That dictionary isn't a board.");
  return config;
}

function photoUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function threadsFrom(rows: ReplyRow[], userId: string): Map<string, Thread[]> {
  const byPost = new Map<string, Map<string, Thread>>();
  for (const rep of rows) {
    const threads = byPost.get(rep.post_id) ?? new Map<string, Thread>();
    const t = threads.get(rep.replier_user_id) ?? { replierId: rep.replier_user_id, replierName: "", replies: [], yourTurn: false };
    if (rep.sender_user_id === rep.replier_user_id) t.replierName = rep.sender_name;
    t.replies.push({
      id: rep.id,
      mine: rep.sender_user_id === userId,
      senderName: rep.sender_name,
      body: rep.body,
      createdAt: rep.created_at,
    });
    threads.set(rep.replier_user_id, t);
    byPost.set(rep.post_id, threads);
  }
  const out = new Map<string, Thread[]>();
  for (const [postId, threads] of byPost) {
    const list = [...threads.values()];
    for (const t of list) t.yourTurn = !t.replies[t.replies.length - 1]?.mine;
    out.set(postId, list);
  }
  return out;
}

const lastAt = (threads: Thread[]) =>
  threads.reduce((max, t) => {
    const at = t.replies[t.replies.length - 1]?.createdAt ?? "";
    return at > max ? at : max;
  }, "");

export async function loadBoard(
  supabase: SupabaseClient,
  userId: string,
  dictionaryId: string,
  filters: BoardFilters,
): Promise<Board> {
  const config = await boardFor(supabase, dictionaryId);
  const now = new Date().toISOString();

  const [boardRow, kindsRes, stewardRes, confirmRes, orgsRes, blocksRes, savesRes, repliesRes, mineRes] = await Promise.all([
    supabase.from("post_boards").select("intro, settings").eq("dictionary_id", dictionaryId).maybeSingle(),
    supabase
      .from("post_kinds")
      .select("name, description, expires_days, adult_only, one_per_person, stewards_only, mutual, open")
      .eq("dictionary_id", dictionaryId)
      .order("position"),
    supabase.rpc("is_steward", { p_dictionary_id: dictionaryId }),
    supabase.from("board_confirmations").select("adult_at").eq("dictionary_id", dictionaryId).eq("user_id", userId).maybeSingle(),
    supabase.from("organization_members").select("organization:organizations(id, name, verified)").eq("user_id", userId),
    supabase.from("user_blocks").select("blocked_user_id, blocked_name").eq("blocker_user_id", userId).order("created_at"),
    supabase.from("post_saves").select("post_id").eq("user_id", userId),
    // Every thread you're in on this board, newest first. Stewards also see
    // reported threads here; those are kept out of your inbox below.
    supabase
      .from("post_replies")
      .select("id, post_id, replier_user_id, sender_user_id, sender_name, body, created_at, posts!inner(dictionary_id, author_user_id)")
      .eq("posts.dictionary_id", dictionaryId)
      .order("created_at", { ascending: true })
      .limit(2000),
    supabase
      .from("posts")
      .select("id, kind, title, labels, details")
      .eq("dictionary_id", dictionaryId)
      .eq("author_user_id", userId)
      .eq("status", "open")
      .gt("expires_at", now)
      .limit(50),
  ]);
  for (const r of [kindsRes, stewardRes, orgsRes, blocksRes, savesRes, repliesRes, mineRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const isSteward = Boolean(stewardRes.data);
  const kinds: PostKind[] = (kindsRes.data ?? []).map((k) => ({
    name: k.name,
    description: k.description,
    expiresDays: k.expires_days,
    adultOnly: k.adult_only,
    onePerPerson: k.one_per_person,
    stewardsOnly: k.stewards_only,
    mutual: k.mutual,
    open: k.open,
  }));

  type ThreadRow = ReplyRow & { posts: { author_user_id: string } | { author_user_id: string }[] };
  const myReplyRows = ((repliesRes.data ?? []) as unknown as ThreadRow[]).filter((r) => {
    const post = Array.isArray(r.posts) ? r.posts[0] : r.posts;
    return r.replier_user_id === userId || post?.author_user_id === userId;
  });
  const threadsByPost = threadsFrom(myReplyRows, userId);
  let waiting = 0;
  for (const threads of threadsByPost.values()) waiting += threads.filter((t) => t.yourTurn).length;

  const savedIds = new Set((savesRes.data ?? []).map((s) => s.post_id as string));

  // The posts for this view.
  let q = supabase.from("posts").select(COLUMNS).eq("dictionary_id", dictionaryId);
  if (filters.view === "mine") {
    q = q.eq("author_user_id", userId);
  } else if (filters.view === "saved" || filters.view === "inbox") {
    const ids = filters.view === "saved" ? [...savedIds] : [...threadsByPost.keys()];
    q = q.in("id", ids.length ? ids.slice(0, 150) : ["00000000-0000-0000-0000-000000000000"]);
  } else if (filters.view === "review") {
    if (!isSteward) throw new Error("Only stewards review posts.");
    q = q.not("hidden_at", "is", null).is("review", null);
  } else {
    q = q.eq("status", "open").is("hidden_at", null).gt("expires_at", now);
  }
  if (filters.view !== "review" && filters.view !== "inbox") {
    if (filters.kinds.length > 0) q = q.in("kind", filters.kinds);
    if (filters.labels.length > 0) q = q.overlaps("labels", filters.labels);
    if (filters.neighborhood) q = q.eq("neighborhood", filters.neighborhood);
    const text = filters.q.trim().replace(/[%,()*\\]/g, " ").trim();
    if (text) q = q.or(`title.ilike.%${text}%,body.ilike.%${text}%,neighborhood.ilike.%${text}%,price.ilike.%${text}%`);
  }
  q = filters.sort === "votes" ? q.order("vote_count", { ascending: false }).order("created_at", { ascending: false }) : q.order("created_at", { ascending: false });

  const postsRes = await q.limit(150);
  if (postsRes.error) throw new Error(postsRes.error.message);
  const rows = (postsRes.data ?? []) as unknown as PostRow[];

  // Organization names, from the posts and your own memberships.
  type Org = { id: string; name: string; verified: boolean };
  const myOrgs: Org[] = (orgsRes.data ?? [])
    .map((m) => (Array.isArray(m.organization) ? m.organization[0] : m.organization) as Org | null)
    .filter((o): o is Org => Boolean(o));
  const orgIds = [...new Set(rows.map((r) => r.organization_id).filter((id): id is string => Boolean(id)))];
  const orgById = new Map<string, Org>(myOrgs.map((o) => [o.id, o]));
  const missing = orgIds.filter((id) => !orgById.has(id));
  if (missing.length > 0) {
    const { data } = await supabase.from("organizations").select("id, name, verified").in("id", missing);
    for (const o of data ?? []) orgById.set(o.id, o);
  }

  // Your sparks, on boards that have them.
  const settings = (boardRow.data?.settings as Record<string, unknown>) ?? {};
  const votedIds = new Set<string>();
  if (settings.votes && rows.length > 0) {
    const { data, error } = await supabase.from("post_votes").select("post_id").eq("user_id", userId).in("post_id", rows.map((r) => r.id));
    if (error) throw new Error(error.message);
    for (const v of data ?? []) votedIds.add(v.post_id);
  }

  const toPost = (r: PostRow): Post => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    neighborhood: r.neighborhood,
    price: r.price,
    labels: r.labels ?? [],
    details: r.details ?? {},
    photos: (r.photos ?? []).map((path) => ({ path, url: photoUrl(supabase, path) })),
    status: r.status,
    authorName: r.author_name || "A Stardust spark",
    organization: r.organization_id ? orgById.get(r.organization_id) ?? null : null,
    mine: r.author_user_id === userId,
    hidden: r.hidden_at !== null,
    review: r.review,
    expired: !neverExpires(r.expires_at) && r.expires_at <= now,
    expiresAt: neverExpires(r.expires_at) ? null : r.expires_at,
    createdAt: r.created_at,
    saved: savedIds.has(r.id),
    voted: votedIds.has(r.id),
    voteCount: r.vote_count,
    commentCount: r.comment_count,
    joinCount: r.join_count,
    threads: threadsByPost.get(r.id) ?? [],
  });

  let posts = rows.map(toPost);
  if (filters.view === "inbox") posts = posts.sort((a, b) => lastAt(b.threads).localeCompare(lastAt(a.threads)));

  // Labels and neighborhoods across what's showing, most used first, for the filters.
  const count = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  };

  let review: Board["review"] = null;
  if (isSteward && filters.view === "review") review = await loadReview(supabase, dictionaryId, posts, userId, Boolean(settings.comments));

  return {
    address: config.address,
    intro: boardRow.data?.intro ?? "",
    settings,
    kinds,
    labels: count(rows.flatMap((r) => r.labels ?? [])).slice(0, 24),
    neighborhoods: count(rows.map((r) => r.neighborhood)).slice(0, 30),
    posts,
    waiting,
    mineOpen: (mineRes.data ?? []).map((m) => ({ id: m.id, kind: m.kind, title: m.title, labels: m.labels ?? [], details: m.details ?? {} })),
    me: {
      userId,
      isSteward,
      adultConfirmed: Boolean(confirmRes.data?.adult_at),
      organizations: myOrgs,
      blocked: (blocksRes.data ?? []).map((b) => ({ userId: b.blocked_user_id, name: b.blocked_name || "A spark" })),
    },
    review,
  };
}

// Your open post this one matches: a kind it pairs with (Wanted and For
// Sale, Looking and Job) sharing at least one label.
export function matchFor(config: BoardConfig, board: Pick<Board, "mineOpen">, post: Post) {
  if (post.mine) return null;
  for (const mine of board.mineOpen) {
    const pairs = config.kinds.find((k) => k.name === mine.kind)?.matches ?? [];
    if (!pairs.includes(post.kind)) continue;
    const shared = post.labels.filter((l) => mine.labels.includes(l));
    if (shared.length > 0) return { mine, shared };
  }
  return null;
}

// What a steward needs: each hidden post's reports, and every open thread
// report with its messages.
async function loadReview(supabase: SupabaseClient, dictionaryId: string, hidden: Post[], userId: string, comments: boolean) {
  const ids = hidden.map((p) => p.id);
  const reportsRes = ids.length
    ? await supabase.from("post_reports").select("post_id, reason, note, created_at").in("post_id", ids).order("created_at")
    : { data: [], error: null };
  if (reportsRes.error) throw new Error(reportsRes.error.message);

  const threadReportsRes = await supabase
    .from("thread_reports")
    .select("post_id, replier_user_id, reason, note, posts!inner(dictionary_id, title)")
    .eq("posts.dictionary_id", dictionaryId)
    .is("resolved_at", null)
    .limit(100);
  if (threadReportsRes.error) throw new Error(threadReportsRes.error.message);

  type TR = { post_id: string; replier_user_id: string; reason: string; note: string; posts: { title: string } | { title: string }[] };
  const grouped = new Map<string, ThreadReview>();
  for (const r of (threadReportsRes.data ?? []) as unknown as TR[]) {
    const key = `${r.post_id}:${r.replier_user_id}`;
    const post = Array.isArray(r.posts) ? r.posts[0] : r.posts;
    const t = grouped.get(key) ?? { postId: r.post_id, postTitle: post?.title ?? "", replierId: r.replier_user_id, reasons: [], notes: [], replies: [] };
    t.reasons.push(r.reason);
    if (r.note) t.notes.push(r.note);
    grouped.set(key, t);
  }
  const threads = [...grouped.values()];
  if (threads.length > 0) {
    const { data, error } = await supabase
      .from("post_replies")
      .select("id, post_id, replier_user_id, sender_user_id, sender_name, body, created_at")
      .in("post_id", [...new Set(threads.map((t) => t.postId))])
      .order("created_at");
    if (error) throw new Error(error.message);
    for (const rep of (data ?? []) as ReplyRow[]) {
      const t = grouped.get(`${rep.post_id}:${rep.replier_user_id}`);
      if (t) t.replies.push({ id: rep.id, mine: rep.sender_user_id === userId, senderName: rep.sender_name, body: rep.body, createdAt: rep.created_at });
    }
  }

  // Hidden comments, on boards that have comments.
  const commentReviews: CommentReview[] = [];
  if (comments) {
    const { data, error } = await supabase
      .from("post_comments")
      .select("id, post_id, parent_id, author_user_id, author_name, body, hidden_at, created_at, posts!inner(dictionary_id, title), comment_reports(reason, note)")
      .eq("posts.dictionary_id", dictionaryId)
      .not("hidden_at", "is", null)
      .is("review", null)
      .limit(100);
    if (error) throw new Error(error.message);
    type CR = CommentRow & { posts: { title: string } | { title: string }[]; comment_reports: { reason: string; note: string }[] | null };
    for (const c of (data ?? []) as unknown as CR[]) {
      const post = Array.isArray(c.posts) ? c.posts[0] : c.posts;
      commentReviews.push({ comment: toComment(c, userId), postId: c.post_id, postTitle: post?.title ?? "", reports: c.comment_reports ?? [] });
    }
  }

  return {
    comments: commentReviews,
    posts: hidden.map((post) => ({
      post,
      reports: (reportsRes.data ?? [])
        .filter((r) => r.post_id === post.id)
        .map((r) => ({ reason: r.reason, note: r.note, createdAt: r.created_at })),
    })),
    threads,
  };
}

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export type CleanPost = {
  kind: string;
  title: string;
  body: string;
  neighborhood: string;
  price: string;
  labels: string[];
  details: Record<string, unknown>;
  photos: string[];
  organization_id: string | null;
};

// Checks a post against its board's kind: title, kind, the money line, and
// the kind's own fields. Wording checks run separately so the poster can
// see them and decide.
export function cleanPost(config: BoardConfig, input: Record<string, unknown>, userId: string): { post: CleanPost } | { error: string } {
  const kindName = text(input.kind, 40);
  const kind = kindOf(config, kindName);
  if (!kind) return { error: `Pick what kind of post it is: ${config.kinds.map((k) => k.name).join(", ")}.` };
  const title = text(input.title, 120);
  if (!title) return { error: "Give your post a title." };
  const price = kind.price ? text(input.price, 60) : "";
  if (kind.price?.required && !price) return { error: `${kind.price.label} is needed for a ${kind.name} post.` };
  const details = cleanDetails(kind, input.details);
  if ("error" in details) return details;
  const { age_min: low, age_max: high } = details.details;
  if (low && high && Number(low) > Number(high)) return { error: "The lower age goes first." };
  const photos = (Array.isArray(input.photos) ? input.photos : [])
    .map((p) => String(p))
    .filter((p) => p.startsWith(`${userId}/`) && /^[A-Za-z0-9._/-]+$/.test(p))
    .slice(0, config.photos);
  const org = text(input.organizationId, 40);
  return {
    post: {
      kind: kind.name,
      title,
      body: text(input.body, 5000),
      neighborhood: text(input.neighborhood, 60),
      price,
      labels: cleanLabels(input.labels),
      details: details.details,
      photos,
      organization_id: /^[0-9a-f-]{36}$/.test(org) ? org : null,
    },
  };
}

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_user_id: string;
  author_name: string;
  body: string;
  hidden_at: string | null;
  created_at: string;
};

function toComment(c: CommentRow, userId: string): Comment {
  return {
    id: c.id,
    parentId: c.parent_id,
    authorName: c.author_name || "A Stardust spark",
    mine: c.author_user_id === userId,
    body: c.body,
    hidden: c.hidden_at !== null,
    createdAt: c.created_at,
  };
}

// One post's open conversation and who's in, loaded when it's opened.
export async function loadExtras(supabase: SupabaseClient, userId: string, postId: string) {
  const [comments, joins] = await Promise.all([
    supabase
      .from("post_comments")
      .select("id, post_id, parent_id, author_user_id, author_name, body, hidden_at, created_at")
      .eq("post_id", postId)
      .order("created_at")
      .limit(500),
    supabase.from("post_joins").select("user_id, user_name, offer").eq("post_id", postId).order("created_at"),
  ]);
  if (comments.error) throw new Error(comments.error.message);
  if (joins.error) throw new Error(joins.error.message);
  return {
    comments: ((comments.data ?? []) as CommentRow[]).map((c) => toComment(c, userId)),
    joins: (joins.data ?? []).map((j): Join => ({ userId: j.user_id, name: j.user_name || "A spark", offer: j.offer, mine: j.user_id === userId })),
  };
}
