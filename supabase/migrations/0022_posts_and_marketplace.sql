-- Posts: one shared piece for every board, and Marketplace DS, the first
-- board on it. Job Match, Idea Index, Manifesto Match, and Idea House come
-- in their own migrations and only add a board, its kinds, and what that
-- board needs on top.
--
-- A board is a shared dictionary with a row in post_boards. It names its
-- kinds of post in post_kinds (Marketplace: For Sale, Free, Wanted, Trade,
-- Housing). Labels on a post power search and filters.
--
-- Safety from day one, kept here in the database so no client can skip it:
--   Every post and reply comes from a signed-in spark; nothing anonymous.
--   Report: three reports hide a post until a steward reviews it.
--   Block: works both ways. Neither sees the other's posts or can message.
--   Replies are private between the poster and the one replying. A steward
--   reads a thread only after one side reports it.
--   Rate limits: 10 posts a day, 60 messages an hour.
--   Posts expire after their kind's number of days; renewing restarts it.
--
-- Trusted updates: the author can't touch a post's counts, hidden state,
-- review, or expiry. The functions that may (reports, reviews, and later
-- votes and comments) set stardust.trusted for their own transaction, and
-- posts_guard lets those through. Clients can't set it: PostgREST doesn't
-- expose set_config, and the setting is local to one transaction.

-- Display kinds for all five boards, so later migrations only add rows.
alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                            'notepad', 'contacts', 'birthdays', 'wolffie_games',
                            'marketplace', 'jobs', 'ideas', 'manifesto', 'idea_house'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                                     'notepad', 'contacts', 'birthdays', 'wolffie_games',
                                     'marketplace', 'jobs', 'ideas', 'manifesto', 'idea_house'));

-- ---------------------------------------------------------------------------
-- Boards and kinds

create table if not exists post_boards (
  dictionary_id uuid primary key references dictionaries(id) on delete cascade,
  -- A line or two shown at the top of the board.
  intro text not null default '' check (length(intro) <= 2000),
  -- Board-only settings, like Idea House's ledger link.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object')
);

alter table post_boards enable row level security;

drop policy if exists "anyone reads boards" on post_boards;
create policy "anyone reads boards"
  on post_boards for select to anon, authenticated
  using (true);

create table if not exists post_kinds (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  description text not null default '',
  position smallint not null default 0,
  -- How long a post lasts before it drops off the board. Null: never.
  expires_days smallint check (expires_days between 1 and 365),
  -- Seen and posted only after an 18+ confirmation for this board.
  adult_only boolean not null default false,
  -- One post of this kind per spark on this board (a manifesto).
  one_per_person boolean not null default false,
  -- Seen only by the poster and the board's stewards (an application).
  stewards_only boolean not null default false,
  -- See others' posts of this kind only once you have your own (a manifesto).
  mutual boolean not null default false,
  -- A kind can be listed before it opens to new posts.
  open boolean not null default true,
  primary key (dictionary_id, name)
);

alter table post_kinds enable row level security;

drop policy if exists "anyone reads post kinds" on post_kinds;
create policy "anyone reads post kinds"
  on post_kinds for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Organizations: Recovery Cafe, SHARE, the Y. Sage adds them by hand once an
-- organization says yes (see dictionaries/BUILD_LOG.md). Members can post as
-- the organization. Verified means Sage talked to a real person there.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null default 'nonprofit' check (kind in ('nonprofit', 'business', 'government')),
  neighborhood text not null default '' check (length(neighborhood) <= 60),
  about text not null default '' check (length(about) <= 1000),
  website text not null default '' check (length(website) <= 200),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx on organization_members(user_id);

alter table organizations enable row level security;
alter table organization_members enable row level security;

drop policy if exists "sparks read organizations" on organizations;
create policy "sparks read organizations"
  on organizations for select to authenticated
  using (true);

drop policy if exists "sparks see their own memberships" on organization_members;
create policy "sparks see their own memberships"
  on organization_members for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stewards review hidden posts and reported threads. dictionary_id null:
-- a steward of every board. Added by hand (see BUILD_LOG.md).

create table if not exists stewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id uuid references dictionaries(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists stewards_one_per_board_idx
  on stewards(user_id, coalesce(dictionary_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table stewards enable row level security;

drop policy if exists "stewards see their own rows" on stewards;
create policy "stewards see their own rows"
  on stewards for select to authenticated
  using (user_id = auth.uid());

create or replace function is_steward(p_dictionary_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from stewards
    where user_id = auth.uid() and (dictionary_id is null or dictionary_id = p_dictionary_id)
  );
$$;

grant execute on function is_steward(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 18+ confirmations, per board. The app checks the birth date before it
-- writes one; only the confirmation time is kept, never the birth date.

create table if not exists board_confirmations (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  adult_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (dictionary_id, user_id)
);

alter table board_confirmations enable row level security;

drop policy if exists "sparks read their own confirmations" on board_confirmations;
create policy "sparks read their own confirmations"
  on board_confirmations for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "sparks confirm for themselves" on board_confirmations;
create policy "sparks confirm for themselves"
  on board_confirmations for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "sparks withdraw their own confirmations" on board_confirmations;
create policy "sparks withdraw their own confirmations"
  on board_confirmations for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Posts

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  -- The poster's name when they posted, so readers never need their profile.
  author_name text not null default '',
  -- Posted as an organization the author belongs to.
  organization_id uuid references organizations(id) on delete set null,
  kind text not null,
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null default '' check (length(body) <= 5000),
  neighborhood text not null default '' check (length(neighborhood) <= 60),
  -- The money line: a price, pay, rent, or cost. A word or a number.
  price text not null default '' check (length(price) <= 60),
  labels text[] not null default '{}',
  -- The kind's own fields (condition, schedule, manifesto lines...).
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and length(details::text) <= 12000),
  -- Storage paths in the post-photos bucket (0023), each under the author's id.
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  status text not null default 'open' check (status in ('open', 'closed')),
  vote_count integer not null default 0,
  comment_count integer not null default 0,
  join_count integer not null default 0,
  report_count integer not null default 0,
  hidden_at timestamptz,
  -- A steward's call: cleared (back up) or removed (stays hidden).
  review text check (review in ('cleared', 'removed')),
  -- When it drops off the board. 'infinity' for kinds that never expire.
  expires_at timestamptz not null default 'infinity',
  renewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (dictionary_id, kind) references post_kinds(dictionary_id, name) on update cascade
);

create index if not exists posts_board_idx on posts(dictionary_id, created_at desc);
create index if not exists posts_board_open_idx on posts(dictionary_id, status, expires_at) where hidden_at is null;
create index if not exists posts_author_idx on posts(author_user_id, created_at desc);
create index if not exists posts_labels_idx on posts using gin(labels);

create table if not exists user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  -- So your blocked list can show who, without reading their profile.
  blocked_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table if not exists post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  -- The two sides of one private thread: the poster and the one replying.
  replier_user_id uuid not null references auth.users(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default '',
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists post_replies_thread_idx on post_replies(post_id, replier_user_id, created_at);
create index if not exists post_replies_sender_idx on post_replies(sender_user_id, created_at desc);

create table if not exists post_reports (
  post_id uuid not null references posts(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'other' check (reason in ('scam', 'unsafe', 'unfair', 'spam', 'sexual', 'other')),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_user_id)
);

-- A reported private thread. The only way a steward reads a message.
create table if not exists thread_reports (
  post_id uuid not null references posts(id) on delete cascade,
  replier_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'other' check (reason in ('scam', 'unsafe', 'unfair', 'spam', 'sexual', 'other')),
  note text not null default '' check (length(note) <= 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (post_id, replier_user_id, reporter_user_id)
);

create table if not exists post_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table posts enable row level security;
alter table user_blocks enable row level security;
alter table post_replies enable row level security;
alter table post_reports enable row level security;
alter table thread_reports enable row level security;
alter table post_saves enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers. Security definer so policies can ask without running into the
-- policies of the table they read.

-- Either of two sparks has blocked the other.
create or replace function is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from user_blocks
    where (blocker_user_id = p_a and blocked_user_id = p_b)
       or (blocker_user_id = p_b and blocked_user_id = p_a)
  );
$$;

grant execute on function is_blocked_between(uuid, uuid) to authenticated;

create or replace function post_author(p_post_id uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select author_user_id from posts where id = p_post_id;
$$;

grant execute on function post_author(uuid) to authenticated;

create or replace function post_board(p_post_id uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select dictionary_id from posts where id = p_post_id;
$$;

grant execute on function post_board(uuid) to authenticated;

-- Whether the caller may see others' posts of this kind at all: not
-- steward-only, not 18+ unless they've confirmed for this board, and for a
-- mutual kind, only once they have their own post of it.
create or replace function can_see_kind(p_dictionary_id uuid, p_kind text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    select not k.stewards_only
       and (not k.adult_only or exists (
         select 1 from board_confirmations c
         where c.dictionary_id = k.dictionary_id and c.user_id = auth.uid() and c.adult_at is not null
       ))
       and (not k.mutual or exists (
         select 1 from posts mine
         where mine.dictionary_id = k.dictionary_id and mine.kind = k.name
           and mine.author_user_id = auth.uid() and mine.status = 'open'
       ))
    from post_kinds k
    where k.dictionary_id = p_dictionary_id and k.name = p_kind
  ), false);
$$;

grant execute on function can_see_kind(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Post policies

drop policy if exists "sparks read posts" on posts;
create policy "sparks read posts"
  on posts for select to authenticated
  using (
    author_user_id = auth.uid()
    or is_steward(dictionary_id)
    or (
      hidden_at is null
      and can_see_kind(dictionary_id, kind)
      and not is_blocked_between(auth.uid(), author_user_id)
    )
  );

drop policy if exists "sparks write their own posts" on posts;
create policy "sparks write their own posts"
  on posts for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (select 1 from post_boards b where b.dictionary_id = posts.dictionary_id)
  );

drop policy if exists "sparks edit their own posts" on posts;
create policy "sparks edit their own posts"
  on posts for update to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

drop policy if exists "sparks delete their own posts" on posts;
create policy "sparks delete their own posts"
  on posts for delete to authenticated
  using (author_user_id = auth.uid());

-- Stamps the author's name, sets the clock, checks the kind's switches and
-- the daily limit, cleans labels, and keeps authors off the columns only
-- trusted functions may change.
create or replace function posts_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_kind post_kinds%rowtype;
  v_trusted boolean := coalesce(current_setting('stardust.trusted', true), '') = 'on';
  v_kind_changed boolean := true;
  v_org_changed boolean := true;
begin
  -- OLD only exists on UPDATE, so it's read only there. A post never moves
  -- boards or authors, so pin those before looking up its kind.
  if tg_op = 'UPDATE' then
    if not v_trusted then
      new.author_user_id := old.author_user_id;
      new.dictionary_id := old.dictionary_id;
    end if;
    v_kind_changed := new.kind is distinct from old.kind;
    v_org_changed := new.organization_id is distinct from old.organization_id;
  end if;

  select * into v_kind from post_kinds where dictionary_id = new.dictionary_id and name = new.kind;
  if not found then
    raise exception 'This board has no kind of post called "%".', new.kind;
  end if;

  if tg_op = 'UPDATE' and not v_trusted then
    new.author_user_id := old.author_user_id;
    new.author_name := old.author_name;
    new.dictionary_id := old.dictionary_id;
    new.vote_count := old.vote_count;
    new.comment_count := old.comment_count;
    new.join_count := old.join_count;
    new.report_count := old.report_count;
    new.hidden_at := old.hidden_at;
    new.review := old.review;
    new.created_at := old.created_at;
    new.updated_at := now();
    if new.renewed_at is distinct from old.renewed_at then
      new.renewed_at := now();
      new.expires_at := case when v_kind.expires_days is null then 'infinity'::timestamptz
                             else now() + make_interval(days => v_kind.expires_days) end;
    else
      new.expires_at := old.expires_at;
    end if;
  end if;

  if not v_trusted and v_kind_changed then
    if not v_kind.open then
      raise exception '% posts aren''t open yet.', new.kind;
    end if;
    if v_kind.adult_only and not exists (
      select 1 from board_confirmations c
      where c.dictionary_id = new.dictionary_id and c.user_id = new.author_user_id and c.adult_at is not null
    ) then
      raise exception 'Confirm you are 18 or older on this board first.';
    end if;
    if v_kind.one_per_person and exists (
      select 1 from posts p
      where p.dictionary_id = new.dictionary_id and p.kind = new.kind
        and p.author_user_id = new.author_user_id and p.id <> new.id
    ) then
      raise exception 'You already have a % post here. Edit that one instead.', new.kind;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from posts p
        where p.author_user_id = new.author_user_id and p.created_at > now() - interval '1 day') >= 10 then
      raise exception 'That''s 10 posts today. Try again tomorrow.';
    end if;
    new.author_name := coalesce((select display_name from profiles where id = new.author_user_id), '');
    new.status := 'open';
    new.vote_count := 0;
    new.comment_count := 0;
    new.join_count := 0;
    new.report_count := 0;
    new.hidden_at := null;
    new.review := null;
    new.renewed_at := null;
    new.created_at := now();
    new.updated_at := now();
    new.expires_at := case when v_kind.expires_days is null then 'infinity'::timestamptz
                           else now() + make_interval(days => v_kind.expires_days) end;
  end if;

  if new.organization_id is not null
     and v_org_changed
     and not exists (
       select 1 from organization_members m
       where m.organization_id = new.organization_id and m.user_id = new.author_user_id
     ) then
    raise exception 'You can only post as an organization you belong to.';
  end if;

  new.labels := array(
    select l from (
      select distinct lower(trim(x)) as l from unnest(new.labels) as x
      where length(trim(x)) between 1 and 30
    ) cleaned
    order by l
    limit 10
  );
  return new;
end;
$$;

drop trigger if exists posts_guard on posts;
create trigger posts_guard before insert or update on posts
  for each row execute function posts_guard();

-- ---------------------------------------------------------------------------
-- Blocks

drop policy if exists "sparks manage their own blocks" on user_blocks;
create policy "sparks manage their own blocks"
  on user_blocks for all to authenticated
  using (blocker_user_id = auth.uid())
  with check (blocker_user_id = auth.uid());

create or replace function user_blocks_name()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.blocked_name := coalesce((select display_name from profiles where id = new.blocked_user_id), '');
  return new;
end;
$$;

drop trigger if exists user_blocks_name on user_blocks;
create trigger user_blocks_name before insert on user_blocks
  for each row execute function user_blocks_name();

-- ---------------------------------------------------------------------------
-- Replies: a thread is the poster and one replier. Both read it; either
-- writes to it, unless one has blocked the other. A steward reads a thread
-- only once one side has reported it.

drop policy if exists "both sides read a reply thread" on post_replies;
create policy "both sides read a reply thread"
  on post_replies for select to authenticated
  using (
    replier_user_id = auth.uid()
    or post_author(post_id) = auth.uid()
    or exists (
      select 1 from thread_reports t
      where t.post_id = post_replies.post_id
        and t.replier_user_id = post_replies.replier_user_id
        and is_steward(post_board(t.post_id))
    )
  );

drop policy if exists "both sides write a reply thread" on post_replies;
create policy "both sides write a reply thread"
  on post_replies for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and (replier_user_id = auth.uid() or post_author(post_id) = auth.uid())
    and replier_user_id <> post_author(post_id)
    and not is_blocked_between(replier_user_id, post_author(post_id))
    and exists (select 1 from posts p where p.id = post_replies.post_id)
  );

-- Stamps the sender's name, limits messages, and keeps a closed post from
-- starting new threads (existing ones carry on).
create or replace function post_replies_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from post_replies r
      where r.sender_user_id = new.sender_user_id and r.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'That''s a lot of messages this hour. Take a breath and try again soon.';
  end if;
  if new.sender_user_id = new.replier_user_id
     and (select status from posts where id = new.post_id) = 'closed'
     and not exists (
       select 1 from post_replies r
       where r.post_id = new.post_id and r.replier_user_id = new.replier_user_id
     ) then
    raise exception 'This post is closed.';
  end if;
  new.sender_name := coalesce((select display_name from profiles where id = new.sender_user_id), '');
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists post_replies_name on post_replies;
drop trigger if exists post_replies_guard on post_replies;
create trigger post_replies_guard before insert on post_replies
  for each row execute function post_replies_guard();

-- ---------------------------------------------------------------------------
-- Reports. Sparks write them and never read them back. Stewards read the
-- reports on their boards. Three post reports hide the post.

drop policy if exists "sparks report posts" on post_reports;
create policy "sparks report posts"
  on post_reports for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and post_author(post_id) <> auth.uid()
    and exists (select 1 from posts p where p.id = post_reports.post_id)
  );

drop policy if exists "stewards read post reports" on post_reports;
create policy "stewards read post reports"
  on post_reports for select to authenticated
  using (is_steward(post_board(post_id)));

create or replace function post_reports_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('stardust.trusted', 'on', true);
  update posts
  set report_count = report_count + 1,
      hidden_at = case when report_count + 1 >= 3 and hidden_at is null then now() else hidden_at end,
      review = case when report_count + 1 >= 3 and hidden_at is null then null else review end
  where id = new.post_id;
  perform set_config('stardust.trusted', 'off', true);
  return new;
end;
$$;

drop trigger if exists post_reports_count on post_reports;
create trigger post_reports_count after insert on post_reports
  for each row execute function post_reports_count();

-- Either side of a thread can report it.
drop policy if exists "thread sides report a thread" on thread_reports;
create policy "thread sides report a thread"
  on thread_reports for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and resolved_at is null
    and (replier_user_id = auth.uid() or post_author(post_id) = auth.uid())
    and replier_user_id <> post_author(post_id)
  );

drop policy if exists "stewards read thread reports" on thread_reports;
create policy "stewards read thread reports"
  on thread_reports for select to authenticated
  using (is_steward(post_board(post_id)));

-- A steward's call on a hidden post: clear (back up, count reset) or
-- remove (stays hidden, closed).
create or replace function review_post(p_post_id uuid, p_decision text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_board uuid;
begin
  select dictionary_id into v_board from posts where id = p_post_id;
  if v_board is null or not is_steward(v_board) then
    raise exception 'Only a steward of this board can review its posts.';
  end if;
  if p_decision not in ('clear', 'remove') then
    raise exception 'Pick clear or remove.';
  end if;
  perform set_config('stardust.trusted', 'on', true);
  if p_decision = 'clear' then
    update posts set hidden_at = null, report_count = 0, review = 'cleared' where id = p_post_id;
  else
    update posts set hidden_at = coalesce(hidden_at, now()), review = 'removed', status = 'closed' where id = p_post_id;
  end if;
  perform set_config('stardust.trusted', 'off', true);
end;
$$;

revoke execute on function review_post(uuid, text) from public, anon;
grant execute on function review_post(uuid, text) to authenticated;

-- A steward marks a reported thread looked at.
create or replace function resolve_thread_report(p_post_id uuid, p_replier_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_steward(post_board(p_post_id)) then
    raise exception 'Only a steward of this board can resolve its reports.';
  end if;
  update thread_reports set resolved_at = now()
  where post_id = p_post_id and replier_user_id = p_replier_user_id and resolved_at is null;
end;
$$;

revoke execute on function resolve_thread_report(uuid, uuid) from public, anon;
grant execute on function resolve_thread_report(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Saves: yours alone.

drop policy if exists "sparks read their own saves" on post_saves;
create policy "sparks read their own saves"
  on post_saves for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "sparks save posts they can see" on post_saves;
create policy "sparks save posts they can see"
  on post_saves for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from posts p where p.id = post_saves.post_id));

drop policy if exists "sparks unsave" on post_saves;
create policy "sparks unsave"
  on post_saves for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Core words every board shares.

insert into terms (name) values
  ('Post'), ('Reply'), ('Kind'), ('Steward'), ('Report'), ('Block'), ('Save'), ('Renew')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Post', 'Something a spark puts up on a board for others to find: an item, a room, a job, an idea.', 'noun'),
  ('Reply', 'A private message to the spark who made a post, and their answers back. Only the two of you read it.', 'noun'),
  ('Kind', 'What sort of post it is. Each board names its own kinds: For Sale, Free, Job, Idea.', 'noun'),
  ('Steward', 'A trusted spark who looks at hidden posts and reported threads, then clears or removes them.', 'noun'),
  ('Report', 'Tell a steward a post or thread is a scam, unsafe, unfair, spam, or sexual. Three reports hide a post until a steward looks.', 'verb'),
  ('Block', 'Stop seeing a spark, and stop them seeing you. Neither of you can message the other. You can undo it.', 'verb'),
  ('Save', 'Keep a post to come back to later. Only you see what you saved.', 'verb'),
  ('Renew', 'Keep a post up longer. Posts drop off on their own when their time is up, so boards stay fresh.', 'verb')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core'
on conflict (term_id, dictionary_id) do nothing;

-- ---------------------------------------------------------------------------
-- Marketplace DS: the first board.

insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind
)
values (
  'marketplace-ds', 'Marketplace',
  'Buy, sell, give away, trade, and find a room in Seattle. Reply privately to any post. No ads, ever.',
  'topical', 'shared', 'public', 'approved', false, false, 'marketplace'
)
on conflict (address) do update set display_kind = excluded.display_kind, description = excluded.description;

insert into post_boards (dictionary_id, intro)
select id, 'Buy, sell, give, trade, and find a room near you. Stardust DS handles no money: you pay each other in person. Newest posts first, and nobody pays to be on top.'
from dictionaries where address = 'marketplace-ds'
on conflict (dictionary_id) do nothing;

insert into post_kinds (dictionary_id, name, description, position, expires_days)
select d.id, v.name, v.description, v.position, v.days
from dictionaries d
cross join (values
  ('For Sale', 'Something you are selling. Put a price, even a rough one.', 1, 30),
  ('Free', 'Something you are giving away. Say how you''ll choose who gets it.', 2, 14),
  ('Wanted', 'Something you are looking for.', 3, 30),
  ('Trade', 'Something you would swap, and what you''d like for it.', 4, 30),
  ('Housing', 'A room or a place to live, offered or wanted. Describe the place, not the person.', 5, 21)
) as v(name, description, position, days)
where d.address = 'marketplace-ds'
on conflict (dictionary_id, name) do nothing;

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('marketplace'), ('buy'), ('sell'), ('free'), ('trade'), ('housing'), ('seattle')) as v(label)
where address = 'marketplace-ds'
on conflict do nothing;

insert into terms (name) values
  ('For Sale'), ('Free'), ('Wanted'), ('Trade'), ('Housing'), ('Porch Pickup'), ('Meet Spot'), ('Fair Housing')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('For Sale', 'Something you are selling. Put a price, even a rough one.', 'more'),
  ('Free', 'Something you are giving away. Say how you''ll choose who gets it.', 'more'),
  ('Wanted', 'Something you are looking for.', 'more'),
  ('Trade', 'Something you would swap, and what you''d like for it.', 'more'),
  ('Housing', 'A room or a place to live, offered or wanted. Describe the place, not the person.', 'more'),
  ('Porch Pickup', 'Leaving a free thing outside for someone to collect, so nobody has to meet.', 'noun'),
  ('Meet Spot', 'A busy public place in daylight where two sparks hand something over: a library branch, a grocery store entrance, a police precinct lobby.', 'noun'),
  ('Fair Housing', 'Everyone gets the same shot at a place to live. A housing post never prefers or excludes people by race, color, religion, sex, sexual orientation, gender identity, national origin, family (kids), disability, veteran or military status, or how they pay rent (like a voucher).', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'marketplace-ds'
on conflict (term_id, dictionary_id) do nothing;
