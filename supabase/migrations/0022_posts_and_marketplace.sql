-- Posts: one shared piece for every board. Core gets the nouns and verbs
-- (Post, Reply, Kind; Post, Reply, Report, Block). Each board dictionary
-- says which kinds of post it holds (Marketplace: For Sale, Free, Wanted,
-- Trade, Housing). Labels on a post power search and filters.
--
-- Safety from day one:
--   Every post and reply comes from a signed-in spark; nothing anonymous.
--   Report: three reports hide a post until it's reviewed.
--   Block: you never see a blocked spark's posts, and they can't reply to you.
--   Replies are private between the poster and the one replying.

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                            'notepad', 'contacts', 'birthdays', 'wolffie_games', 'posts'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                                     'notepad', 'contacts', 'birthdays', 'wolffie_games', 'posts'));

-- The kinds of post a board holds, in the order they show.
create table if not exists post_kinds (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  description text not null default '',
  position smallint not null default 0,
  primary key (dictionary_id, name)
);

alter table post_kinds enable row level security;

create policy "anyone reads post kinds"
  on post_kinds for select to anon, authenticated
  using (true);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  -- The poster's name when they posted, so readers never need their profile.
  author_name text not null default '',
  kind text not null,
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null default '' check (length(body) <= 5000),
  neighborhood text not null default '' check (length(neighborhood) <= 60),
  -- A price, "free", "$900/mo", "make an offer": a word or a number.
  price text not null default '' check (length(price) <= 40),
  labels text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'closed')),
  report_count integer not null default 0,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (dictionary_id, kind) references post_kinds(dictionary_id, name) on update cascade
);

create index if not exists posts_board_idx on posts(dictionary_id, created_at desc);
create index if not exists posts_labels_idx on posts using gin(labels);

create table if not exists user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
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

create table if not exists post_reports (
  post_id uuid not null references posts(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_user_id)
);

alter table posts enable row level security;
alter table user_blocks enable row level security;
alter table post_replies enable row level security;
alter table post_reports enable row level security;

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

-- Reading: signed-in sparks see open and closed posts that aren't hidden and
-- aren't from someone blocked either way. You always see your own.
create policy "sparks read posts"
  on posts for select to authenticated
  using (
    author_user_id = auth.uid()
    or (hidden_at is null and not is_blocked_between(auth.uid(), author_user_id))
  );

create policy "sparks write their own posts"
  on posts for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (select 1 from dictionaries where id = dictionary_id and display_kind = 'posts')
  );

create policy "sparks edit their own posts"
  on posts for update to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

create policy "sparks delete their own posts"
  on posts for delete to authenticated
  using (author_user_id = auth.uid());

-- The author can't edit their own report count or unhide a reported post.
create or replace function posts_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.author_name := coalesce((select display_name from profiles where id = new.author_user_id), '');
    new.report_count := 0;
    new.hidden_at := null;
  else
    new.author_user_id := old.author_user_id;
    new.author_name := old.author_name;
    new.dictionary_id := old.dictionary_id;
    new.report_count := old.report_count;
    new.hidden_at := old.hidden_at;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  new.labels := array(
    select distinct lower(trim(l)) from unnest(new.labels) as l
    where length(trim(l)) between 1 and 30
    limit 10
  );
  return new;
end;
$$;

drop trigger if exists posts_guard on posts;
create trigger posts_guard before insert or update on posts
  for each row execute function posts_guard();

create policy "sparks manage their own blocks"
  on user_blocks for all to authenticated
  using (blocker_user_id = auth.uid())
  with check (blocker_user_id = auth.uid());

-- A thread is the poster and one replier. Both read it; either writes to
-- it, unless one has blocked the other or the post is closed to new threads.
create policy "both sides read a reply thread"
  on post_replies for select to authenticated
  using (replier_user_id = auth.uid() or post_author(post_id) = auth.uid());

create policy "both sides write a reply thread"
  on post_replies for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and (replier_user_id = auth.uid() or post_author(post_id) = auth.uid())
    and replier_user_id <> post_author(post_id)
    and not is_blocked_between(replier_user_id, post_author(post_id))
  );

create or replace function post_replies_name()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.sender_name := coalesce((select display_name from profiles where id = new.sender_user_id), '');
  return new;
end;
$$;

drop trigger if exists post_replies_name on post_replies;
create trigger post_replies_name before insert on post_replies
  for each row execute function post_replies_name();

-- Reports are written, never read back by sparks. Three hide the post.
create policy "sparks report posts"
  on post_reports for insert to authenticated
  with check (reporter_user_id = auth.uid() and post_author(post_id) <> auth.uid());

create or replace function post_reports_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update posts
  set report_count = report_count + 1,
      hidden_at = case when report_count + 1 >= 3 then coalesce(hidden_at, now()) else hidden_at end
  where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists post_reports_count on post_reports;
create trigger post_reports_count after insert on post_reports
  for each row execute function post_reports_count();

-- Core words every board shares.
insert into terms (name) values ('Post'), ('Reply'), ('Kind'), ('Report'), ('Block') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Post', 'Something a spark puts up on a board for others to find: an item, a room, a job, an idea.', 'noun'),
  ('Reply', 'A private message to the spark who made a post, and their answers back.', 'noun'),
  ('Kind', 'What sort of post it is. Each board names its own kinds: For Sale, Free, Housing, Job.', 'noun'),
  ('Report', 'Tell Stardust DS a post is a scam, unsafe, or breaks the rules. Three reports hide it.', 'verb'),
  ('Block', 'Stop seeing a spark''s posts and stop them from replying to you.', 'verb')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core'
on conflict (term_id, dictionary_id) do nothing;

-- Marketplace DS: the first board.
insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind
)
values (
  'marketplace-ds', 'Marketplace',
  'Buy, sell, give away, trade, and find housing in Seattle. Reply privately to any post.',
  'topical', 'shared', 'public', 'approved', false, false, 'posts'
)
on conflict (address) do nothing;

insert into post_kinds (dictionary_id, name, description, position)
select d.id, v.name, v.description, v.position
from dictionaries d
cross join (values
  ('For Sale', 'Something you are selling. Put the price in Price.', 1),
  ('Free', 'Something you are giving away.', 2),
  ('Wanted', 'Something you are looking for.', 3),
  ('Trade', 'Something you would swap.', 4),
  ('Housing', 'A room or apartment. Describe the place, not who you want: no preferences by race, religion, sex, family, disability, or where someone is from.', 5)
) as v(name, description, position)
where d.address = 'marketplace-ds'
on conflict do nothing;

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('marketplace'), ('buy'), ('sell'), ('free'), ('housing'), ('seattle')) as v(label)
where address = 'marketplace-ds'
on conflict do nothing;

insert into terms (name) values ('For Sale'), ('Free'), ('Wanted'), ('Trade'), ('Housing') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, k.description, 'more'
from post_kinds k
join dictionaries d on d.id = k.dictionary_id and d.address = 'marketplace-ds'
join terms t on t.name = k.name
on conflict (term_id, dictionary_id) do nothing;
