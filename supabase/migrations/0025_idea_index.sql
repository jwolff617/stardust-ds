-- Idea Index DS on Posts (0022): ideas, sparks (one-tap love, no
-- downvotes), open comments with one level of replies, and I'm In (say
-- you'd help build it). Counts live on posts and are changed only by the
-- trusted triggers here (see the note at the top of 0022).
--
-- Needs 0022.

insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind
)
values (
  'idea-index-ds', 'Idea Index',
  'Post an idea, spark the ones you love, talk them through, and find people to build them with. No downvotes, no leaderboard.',
  'topical', 'shared', 'public', 'approved', false, false, 'ideas'
)
on conflict (address) do update set display_kind = excluded.display_kind, description = excluded.description;

insert into post_boards (dictionary_id, intro, settings)
select id,
  'Ideas for Seattle, big and small. Spark the ones you love, and say I''m in when you''d help build one. New ideas show first, so quiet ones get a fair start.',
  '{"votes": true, "comments": true, "joins": true}'::jsonb
from dictionaries where address = 'idea-index-ds'
on conflict (dictionary_id) do update set settings = excluded.settings;

insert into post_kinds (dictionary_id, name, description, position, expires_days)
select d.id, v.name, v.description, v.position, v.days
from dictionaries d
cross join (values
  ('Idea', 'A thought that could be built. Say the problem it solves and a first small step.', 1, null::smallint),
  ('Building', 'You''re making it now. Say how people can help.', 2, null::smallint),
  ('Need', 'A problem looking for an idea. Say who has it and what would help.', 3, 90::smallint)
) as v(name, description, position, days)
where d.address = 'idea-index-ds'
on conflict (dictionary_id, name) do nothing;

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('idea'), ('ideas'), ('build'), ('community'), ('collaborate'), ('seattle')) as v(label)
where address = 'idea-index-ds'
on conflict do nothing;

-- Whether a board has a feature on (votes, comments, joins).
create or replace function board_has(p_dictionary_id uuid, p_feature text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select (settings ->> p_feature)::boolean from post_boards where dictionary_id = p_dictionary_id), false);
$$;

grant execute on function board_has(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sparks: one per spark per post, never on your own.

create table if not exists post_votes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_votes enable row level security;

drop policy if exists "sparks see their own sparks" on post_votes;
create policy "sparks see their own sparks"
  on post_votes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "sparks spark posts they can see" on post_votes;
create policy "sparks spark posts they can see"
  on post_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and post_author(post_id) <> auth.uid()
    and board_has(post_board(post_id), 'votes')
    and exists (select 1 from posts p where p.id = post_votes.post_id)
  );

drop policy if exists "sparks take back their sparks" on post_votes;
create policy "sparks take back their sparks"
  on post_votes for delete to authenticated
  using (user_id = auth.uid());

create or replace function post_votes_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('stardust.trusted', 'on', true);
  if tg_op = 'INSERT' then
    update posts set vote_count = vote_count + 1 where id = new.post_id;
  else
    update posts set vote_count = greatest(vote_count - 1, 0) where id = old.post_id;
  end if;
  perform set_config('stardust.trusted', 'off', true);
  return null;
end;
$$;

drop trigger if exists post_votes_count on post_votes;
create trigger post_votes_count after insert or delete on post_votes
  for each row execute function post_votes_count();

-- ---------------------------------------------------------------------------
-- Comments: open to everyone who can see the post, one level of replies.

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  parent_id uuid references post_comments(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null check (length(trim(body)) between 1 and 2000),
  report_count integer not null default 0,
  hidden_at timestamptz,
  review text check (review in ('cleared', 'removed')),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on post_comments(post_id, created_at);

create table if not exists comment_reports (
  comment_id uuid not null references post_comments(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'other' check (reason in ('scam', 'unsafe', 'unfair', 'spam', 'sexual', 'other')),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (comment_id, reporter_user_id)
);

alter table post_comments enable row level security;
alter table comment_reports enable row level security;

-- The post subquery runs under posts' own policy, so a comment shows only
-- where its post does.
drop policy if exists "sparks read comments" on post_comments;
create policy "sparks read comments"
  on post_comments for select to authenticated
  using (
    exists (select 1 from posts p where p.id = post_comments.post_id)
    and (
      author_user_id = auth.uid()
      or is_steward(post_board(post_id))
      or (hidden_at is null and not is_blocked_between(auth.uid(), author_user_id))
    )
  );

drop policy if exists "sparks comment on posts they can see" on post_comments;
create policy "sparks comment on posts they can see"
  on post_comments for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and board_has(post_board(post_id), 'comments')
    and exists (select 1 from posts p where p.id = post_comments.post_id)
    and not is_blocked_between(auth.uid(), post_author(post_id))
  );

drop policy if exists "sparks delete their own comments" on post_comments;
create policy "sparks delete their own comments"
  on post_comments for delete to authenticated
  using (author_user_id = auth.uid());

-- Stamps the name and time, keeps replies one level deep on the same post,
-- limits comments, and clears report state on the way in.
create or replace function post_comments_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_parent post_comments%rowtype;
begin
  if new.parent_id is not null then
    select * into v_parent from post_comments where id = new.parent_id;
    if not found or v_parent.post_id <> new.post_id then
      raise exception 'That comment is gone.';
    end if;
    -- A reply to a reply joins the same thread.
    if v_parent.parent_id is not null then
      new.parent_id := v_parent.parent_id;
    end if;
  end if;
  if (select count(*) from post_comments c
      where c.author_user_id = new.author_user_id and c.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'That''s a lot of comments this hour. Try again soon.';
  end if;
  new.author_name := coalesce((select display_name from profiles where id = new.author_user_id), '');
  new.report_count := 0;
  new.hidden_at := null;
  new.review := null;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists post_comments_guard on post_comments;
create trigger post_comments_guard before insert on post_comments
  for each row execute function post_comments_guard();

create or replace function post_comments_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('stardust.trusted', 'on', true);
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  perform set_config('stardust.trusted', 'off', true);
  return null;
end;
$$;

drop trigger if exists post_comments_count on post_comments;
create trigger post_comments_count after insert or delete on post_comments
  for each row execute function post_comments_count();

drop policy if exists "sparks report comments" on comment_reports;
create policy "sparks report comments"
  on comment_reports for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and exists (
      select 1 from post_comments c
      where c.id = comment_reports.comment_id and c.author_user_id <> auth.uid()
    )
  );

drop policy if exists "stewards read comment reports" on comment_reports;
create policy "stewards read comment reports"
  on comment_reports for select to authenticated
  using (
    exists (
      select 1 from post_comments c
      where c.id = comment_reports.comment_id and is_steward(post_board(c.post_id))
    )
  );

create or replace function comment_reports_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update post_comments
  set report_count = report_count + 1,
      hidden_at = case when report_count + 1 >= 3 and hidden_at is null then now() else hidden_at end,
      review = case when report_count + 1 >= 3 and hidden_at is null then null else review end
  where id = new.comment_id;
  return new;
end;
$$;

drop trigger if exists comment_reports_count on comment_reports;
create trigger comment_reports_count after insert on comment_reports
  for each row execute function comment_reports_count();

create or replace function review_comment(p_comment_id uuid, p_decision text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_post uuid;
begin
  select post_id into v_post from post_comments where id = p_comment_id;
  if v_post is null or not is_steward(post_board(v_post)) then
    raise exception 'Only a steward of this board can review its comments.';
  end if;
  if p_decision = 'clear' then
    update post_comments set hidden_at = null, report_count = 0, review = 'cleared' where id = p_comment_id;
  elsif p_decision = 'remove' then
    update post_comments set hidden_at = coalesce(hidden_at, now()), review = 'removed' where id = p_comment_id;
  else
    raise exception 'Pick clear or remove.';
  end if;
end;
$$;

revoke execute on function review_comment(uuid, text) from public, anon;
grant execute on function review_comment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- I'm In: say you'd help build it, and what you'd bring. Public on the post.

create table if not exists post_joins (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null default '',
  offer text not null default '' check (length(offer) <= 200),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_joins enable row level security;

drop policy if exists "sparks see who's in" on post_joins;
create policy "sparks see who's in"
  on post_joins for select to authenticated
  using (
    exists (select 1 from posts p where p.id = post_joins.post_id)
    and (user_id = auth.uid() or not is_blocked_between(auth.uid(), user_id))
  );

drop policy if exists "sparks say they're in" on post_joins;
create policy "sparks say they're in"
  on post_joins for insert to authenticated
  with check (
    user_id = auth.uid()
    and post_author(post_id) <> auth.uid()
    and board_has(post_board(post_id), 'joins')
    and exists (select 1 from posts p where p.id = post_joins.post_id)
  );

-- Change what you'd bring.
drop policy if exists "sparks change their offer" on post_joins;
create policy "sparks change their offer"
  on post_joins for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- You can step out; the poster can take someone off their idea.
drop policy if exists "sparks step out, posters take off" on post_joins;
create policy "sparks step out, posters take off"
  on post_joins for delete to authenticated
  using (user_id = auth.uid() or post_author(post_id) = auth.uid());

create or replace function post_joins_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.user_name := coalesce((select display_name from profiles where id = new.user_id), '');
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists post_joins_guard on post_joins;
create trigger post_joins_guard before insert on post_joins
  for each row execute function post_joins_guard();

create or replace function post_joins_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('stardust.trusted', 'on', true);
  if tg_op = 'INSERT' then
    update posts set join_count = join_count + 1 where id = new.post_id;
  else
    update posts set join_count = greatest(join_count - 1, 0) where id = old.post_id;
  end if;
  perform set_config('stardust.trusted', 'off', true);
  return null;
end;
$$;

drop trigger if exists post_joins_count on post_joins;
create trigger post_joins_count after insert or delete on post_joins
  for each row execute function post_joins_count();

-- ---------------------------------------------------------------------------
-- Words

insert into terms (name) values
  ('Idea'), ('Building'), ('Need'), ('Spark'), ('I''m In'), ('Comment'), ('First Small Step')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Idea', 'A thought that could be built. Says the problem it solves and a first small step.', 'more'),
  ('Building', 'An idea people are making now, and how to come help.', 'more'),
  ('Need', 'A problem looking for an idea. Say who has it and what would help.', 'more'),
  ('Spark', 'Tap to say you love an idea. One per spark per idea, and no downvotes.', 'verb'),
  ('I''m In', 'Say you''d help build an idea, and what you''d bring. Your name shows on it with the others who said yes.', 'verb'),
  ('Comment', 'An open note on an idea that anyone on the board can read, with one level of replies.', 'noun'),
  ('First Small Step', 'The smallest real thing that moves an idea off the page.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'idea-index-ds'
on conflict (term_id, dictionary_id) do nothing;
