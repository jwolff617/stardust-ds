-- Sessions 2 and 3: everything a listing needs to live on its own, then
-- the old Idea Index, Marketplace, and Job Match posts move into listings
-- and those three boards become searches.
--
--   Photos      up to the search's limit (Marketplace 4, Idea Index 1).
--   End date    a search can say how long listings last (Marketplace 30
--               days); the maker renews. Done (sold, filled) closes one.
--   Sparks      a like, kept apart from Add to Library.
--   Comments    public, under a listing or a page.
--   Messages    private, between the maker and one other person.
--   Reports     three people reporting hides a listing or a comment until a
--               moderator clears or removes it.
--   Blocks      someone you blocked disappears from your searches, and
--               neither of you can message the other.

-- 1. Columns ---------------------------------------------------------------

alter table dictionaries
  add column if not exists photos text[] not null default '{}' check (cardinality(photos) <= 4),
  add column if not exists photo_limit smallint not null default 0 check (photo_limit between 0 and 4),
  add column if not exists lasts_days smallint check (lasts_days is null or lasts_days between 1 and 365),
  add column if not exists expires_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists hidden_at timestamptz,
  add column if not exists review text check (review in ('cleared', 'removed')),
  add column if not exists spark_count integer not null default 0,
  add column if not exists from_post_id uuid unique;

create index if not exists dictionaries_listing_live_idx on dictionaries (display_kind, created_at desc)
  where display_kind = 'listing' and hidden_at is null and closed_at is null;

-- Listings: signed-in sparks see them unless hidden, and never from someone
-- they blocked. The maker and moderators always see them.
drop policy if exists "listings and searches are readable by sparks" on dictionaries;
create policy "listings and searches are readable by sparks"
  on dictionaries for select
  using (
    display_kind in ('listing', 'search') and status = 'approved' and auth.uid() is not null
    and (hidden_at is null or owner_user_id = auth.uid() or is_moderator())
    and not exists (select 1 from user_blocks b where b.blocker_user_id = auth.uid() and b.blocked_user_id = dictionaries.owner_user_id)
  );

-- 2. Sparks ----------------------------------------------------------------

create table if not exists dictionary_sparks (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dictionary_id, user_id)
);
alter table dictionary_sparks enable row level security;
drop policy if exists "sparks see their own sparks on dictionaries" on dictionary_sparks;
create policy "sparks see their own sparks on dictionaries"
  on dictionary_sparks for select to authenticated using (user_id = auth.uid());

-- Sparks or unsparks a dictionary. Returns whether it's sparked now.
create or replace function toggle_spark(p_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if not exists (select 1 from dictionaries where id = p_id and owner_user_id is distinct from auth.uid()) then
    raise exception 'You can''t spark your own.';
  end if;
  delete from dictionary_sparks where dictionary_id = p_id and user_id = auth.uid();
  if found then
    update dictionaries set spark_count = greatest(spark_count - 1, 0) where id = p_id;
    return false;
  end if;
  insert into dictionary_sparks (dictionary_id, user_id) values (p_id, auth.uid());
  update dictionaries set spark_count = spark_count + 1 where id = p_id;
  return true;
end;
$$;

-- 3. Comments --------------------------------------------------------------

create table if not exists dictionary_comments (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  author_name text not null default '',
  body text not null check (length(trim(body)) between 1 and 2000),
  hidden_at timestamptz,
  review text check (review in ('cleared', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists dictionary_comments_idx on dictionary_comments (dictionary_id, created_at);
alter table dictionary_comments enable row level security;

drop policy if exists "comments are readable with their dictionary" on dictionary_comments;
create policy "comments are readable with their dictionary"
  on dictionary_comments for select to authenticated
  using (
    exists (select 1 from dictionaries d where d.id = dictionary_comments.dictionary_id)
    and (hidden_at is null or author_user_id = auth.uid() or is_moderator())
    and not exists (select 1 from user_blocks b where b.blocker_user_id = auth.uid() and b.blocked_user_id = dictionary_comments.author_user_id)
  );

drop policy if exists "sparks comment on listings and pages" on dictionary_comments;
create policy "sparks comment on listings and pages"
  on dictionary_comments for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from dictionaries d
      where d.id = dictionary_comments.dictionary_id
        and d.display_kind in ('listing', 'page')
        and d.closed_at is null
        and not exists (select 1 from user_blocks b where b.blocker_user_id = d.owner_user_id and b.blocked_user_id = auth.uid())
    )
  );

-- Your own comment, any comment on your listing, or a moderator.
drop policy if exists "comments are deleted by their author, the owner, or a moderator" on dictionary_comments;
create policy "comments are deleted by their author, the owner, or a moderator"
  on dictionary_comments for delete to authenticated
  using (
    author_user_id = auth.uid()
    or is_moderator()
    or exists (select 1 from dictionaries d where d.id = dictionary_comments.dictionary_id and d.owner_user_id = auth.uid())
  );

create or replace function comment_author_name()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.author_name := coalesce((select display_name from profiles where id = new.author_user_id), '');
  new.hidden_at := null;
  new.review := null;
  return new;
end;
$$;
drop trigger if exists dictionary_comments_name on dictionary_comments;
create trigger dictionary_comments_name before insert on dictionary_comments
  for each row when (auth.uid() is not null) execute function comment_author_name();

-- 4. Messages --------------------------------------------------------------

-- One private thread per listing and person: the maker and the asker.
create table if not exists dictionary_messages (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  asker_user_id uuid not null references auth.users(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default '',
  body text not null check (length(trim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists dictionary_messages_thread_idx on dictionary_messages (dictionary_id, asker_user_id, created_at);
alter table dictionary_messages enable row level security;

drop policy if exists "the two people in a thread read it" on dictionary_messages;
create policy "the two people in a thread read it"
  on dictionary_messages for select to authenticated
  using (
    asker_user_id = auth.uid()
    or exists (select 1 from dictionaries d where d.id = dictionary_messages.dictionary_id and d.owner_user_id = auth.uid())
  );

-- Sends a message. The asker writes to the maker; the maker answers a
-- thread someone started. Blocks stop both ways.
create or replace function send_message(p_id uuid, p_asker uuid, p_body text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_other uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'Write 1 to 2,000 characters.'; end if;
  select owner_user_id into v_owner from dictionaries where id = p_id and display_kind in ('listing', 'page') and hidden_at is null;
  if v_owner is null then raise exception 'That can''t take messages.'; end if;
  if auth.uid() = v_owner then
    if not exists (select 1 from dictionary_messages where dictionary_id = p_id and asker_user_id = p_asker) then
      raise exception 'Answer a message someone sent you.';
    end if;
    v_other := p_asker;
  else
    if p_asker is distinct from auth.uid() then raise exception 'That isn''t your thread.'; end if;
    v_other := v_owner;
  end if;
  if exists (select 1 from user_blocks where (blocker_user_id = auth.uid() and blocked_user_id = v_other)
                                         or (blocker_user_id = v_other and blocked_user_id = auth.uid())) then
    raise exception 'You can''t message each other.';
  end if;
  if (select count(*) from dictionary_messages where sender_user_id = auth.uid() and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'That''s a lot of messages. Try again in a bit.';
  end if;
  insert into dictionary_messages (dictionary_id, asker_user_id, sender_user_id, sender_name, body)
  values (p_id, case when auth.uid() = v_owner then p_asker else auth.uid() end, auth.uid(),
          coalesce((select display_name from profiles where id = auth.uid()), ''), trim(p_body));
end;
$$;

-- Marks a thread read for the caller.
create or replace function read_thread(p_id uuid, p_asker uuid)
returns void
language sql
security definer set search_path = public
as $$
  update dictionary_messages m set read_at = now()
  where m.dictionary_id = p_id and m.asker_user_id = p_asker and m.read_at is null
    and m.sender_user_id <> auth.uid()
    and (m.asker_user_id = auth.uid() or exists (select 1 from dictionaries d where d.id = p_id and d.owner_user_id = auth.uid()));
$$;

-- 5. Reports ---------------------------------------------------------------

create table if not exists dictionary_reports (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  comment_id uuid references dictionary_comments(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reason text not null default 'other' check (reason in ('scam', 'unsafe', 'unfair', 'spam', 'sexual', 'other')),
  note text not null default '' check (length(note) <= 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists dictionary_reports_once_idx
  on dictionary_reports (dictionary_id, coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid), reporter_user_id);
alter table dictionary_reports enable row level security;
drop policy if exists "moderators read reports" on dictionary_reports;
create policy "moderators read reports" on dictionary_reports for select to authenticated using (is_moderator());

-- Reports a listing (or one comment on it). Three people hide it until a
-- moderator looks.
create or replace function report_dictionary(p_id uuid, p_comment uuid, p_reason text, p_note text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  insert into dictionary_reports (dictionary_id, comment_id, reporter_user_id, reason, note)
  values (p_id, p_comment, auth.uid(), coalesce(nullif(p_reason, ''), 'other'), left(coalesce(p_note, ''), 500))
  on conflict do nothing;

  if p_comment is null then
    if (select count(*) from dictionary_reports where dictionary_id = p_id and comment_id is null and resolved_at is null) >= 3 then
      update dictionaries set hidden_at = coalesce(hidden_at, now()) where id = p_id and review is distinct from 'cleared';
    end if;
  elsif (select count(*) from dictionary_reports where comment_id = p_comment and resolved_at is null) >= 3 then
    update dictionary_comments set hidden_at = coalesce(hidden_at, now()) where id = p_comment and review is distinct from 'cleared';
  end if;
end;
$$;

-- A moderator decides: clear (back up, reports closed) or remove.
create or replace function review_dictionary(p_id uuid, p_comment uuid, p_remove boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Only a moderator can do that.'; end if;
  if p_comment is null then
    if p_remove then
      delete from dictionaries where id = p_id and display_kind = 'listing';
    else
      update dictionaries set hidden_at = null, review = 'cleared' where id = p_id;
      update dictionary_reports set resolved_at = now() where dictionary_id = p_id and comment_id is null and resolved_at is null;
    end if;
  else
    if p_remove then
      delete from dictionary_comments where id = p_comment;
    else
      update dictionary_comments set hidden_at = null, review = 'cleared' where id = p_comment;
      update dictionary_reports set resolved_at = now() where comment_id = p_comment and resolved_at is null;
    end if;
  end if;
end;
$$;

-- What moderators need to look at: hidden or reported listings and comments.
create or replace function reports_waiting()
returns table (dictionary_id uuid, comment_id uuid, name text, body text, hidden boolean, reports bigint, reasons text[], last_report timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select r.dictionary_id, r.comment_id, d.name, coalesce(c.body, ''),
         coalesce(c.hidden_at, d.hidden_at) is not null,
         count(*), array_agg(distinct r.reason), max(r.created_at)
  from dictionary_reports r
  join dictionaries d on d.id = r.dictionary_id
  left join dictionary_comments c on c.id = r.comment_id
  where r.resolved_at is null and is_moderator()
  group by r.dictionary_id, r.comment_id, d.name, c.body, c.hidden_at, d.hidden_at
  order by 5 desc, 6 desc, 8 desc
  limit 100;
$$;

-- 6. Listing life: photos, end dates, done -----------------------------------

drop function if exists create_listing(uuid, text, jsonb, text[]);
create or replace function create_listing(p_search uuid, p_name text, p_values jsonb, p_labels text[] default '{}', p_photos text[] default '{}')
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_search dictionaries%rowtype;
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_id uuid;
  v_label text;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give it a name.'; end if;
  select * into v_search from dictionaries where id = p_search;
  if not found or v_search.noun is null or v_search.fields is null then
    raise exception 'That dictionary doesn''t make listings.';
  end if;
  if exists (select 1 from unnest(coalesce(p_photos, '{}')) p where split_part(p, '/', 1) <> auth.uid()::text) then
    raise exception 'Those photos aren''t yours.';
  end if;
  if cardinality(coalesce(p_photos, '{}')) > v_search.photo_limit then
    raise exception 'Up to % photos here.', v_search.photo_limit;
  end if;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'listing'
      and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s 20 today. Try again tomorrow.';
  end if;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'listing') >= 200 then
    raise exception 'You have 200 listings. Delete one to make another.';
  end if;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind, fields, page, by_name, photos, photo_limit, lasts_days, expires_at)
  values ('listing-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance', 'shared', 'public', 'approved',
          false, false, auth.uid(), 'listing', v_search.fields, shape_values(v_search.fields, p_values),
          coalesce((select display_name from profiles where id = auth.uid()), ''),
          coalesce(p_photos, '{}'), v_search.photo_limit, v_search.lasts_days,
          case when v_search.lasts_days is null then null else now() + make_interval(days => v_search.lasts_days) end)
  returning id into v_id;

  foreach v_label in array clean_labels(v_search.shows || coalesce(p_labels, '{}')) loop
    insert into dictionary_labels (dictionary_id, label) values (v_id, v_label) on conflict do nothing;
  end loop;
  return v_id;
end;
$$;

drop function if exists save_listing(uuid, text, jsonb);
create or replace function save_listing(p_id uuid, p_name text, p_values jsonb, p_photos text[] default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_limit smallint;
begin
  select photo_limit into v_limit from dictionaries where id = p_id and owner_user_id = auth.uid() and display_kind = 'listing';
  if not found then raise exception 'That listing isn''t yours.'; end if;
  if p_photos is not null then
    if exists (select 1 from unnest(p_photos) p where split_part(p, '/', 1) <> auth.uid()::text) then
      raise exception 'Those photos aren''t yours.';
    end if;
    if cardinality(p_photos) > v_limit then raise exception 'Up to % photos here.', v_limit; end if;
  end if;
  update dictionaries
  set name = coalesce(left(nullif(trim(p_name), ''), 80), name),
      page = shape_values(fields, p_values),
      photos = coalesce(p_photos, photos)
  where id = p_id;
end;
$$;

-- Done (sold, filled, built) or open again. Renew pushes the end date out.
create or replace function set_listing_done(p_id uuid, p_done boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update dictionaries set closed_at = case when p_done then now() else null end
  where id = p_id and owner_user_id = auth.uid() and display_kind = 'listing';
  if not found then raise exception 'That listing isn''t yours.'; end if;
end;
$$;

create or replace function renew_listing(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update dictionaries set expires_at = now() + make_interval(days => lasts_days), closed_at = null
  where id = p_id and owner_user_id = auth.uid() and display_kind = 'listing' and lasts_days is not null;
  if not found then raise exception 'That listing doesn''t need renewing.'; end if;
end;
$$;

drop function if exists create_search(text, text, text, jsonb, text[]);
create or replace function create_search(p_name text, p_description text, p_noun text, p_fields jsonb, p_imports text[],
                                         p_photo_limit int default 0, p_lasts_days int default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_noun text := left(nullif(lower(trim(p_noun)), ''), 30);
  v_imports text[] := clean_labels(p_imports);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give it a name.'; end if;
  if v_noun is null then raise exception 'Say what it makes, like "idea" or "listing".'; end if;
  if cardinality(v_imports) = 0 then raise exception 'Pick at least one label to search.'; end if;
  perform check_shape(p_fields);
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'search') >= 25 then
    raise exception 'You have 25 searches. Delete one to make another.';
  end if;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind, fields, noun, shows, photo_limit, lasts_days)
  values ('search-' || substr(gen_random_uuid()::text, 1, 12), v_name, left(nullif(trim(p_description), ''), 300),
          'instance', 'shared', 'public', 'approved', false, false, auth.uid(), 'search', p_fields, v_noun, v_imports,
          least(greatest(coalesce(p_photo_limit, 0), 0), 4), case when p_lasts_days between 1 and 365 then p_lasts_days end)
  returning id into v_id;

  insert into dictionary_labels (dictionary_id, label)
  select v_id, l from unnest(v_imports) l on conflict do nothing;
  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;

drop function if exists set_shape(uuid, text, jsonb);
create or replace function set_shape(p_id uuid, p_noun text, p_fields jsonb, p_photo_limit int default 0, p_lasts_days int default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_noun text := left(nullif(lower(trim(p_noun)), ''), 30);
begin
  if v_noun is null then raise exception 'Say what it makes, like "idea" or "listing".'; end if;
  perform check_shape(p_fields);
  update dictionaries
  set noun = v_noun, fields = p_fields,
      photo_limit = least(greatest(coalesce(p_photo_limit, 0), 0), 4),
      lasts_days = case when p_lasts_days between 1 and 365 then p_lasts_days end
  where id = p_id and display_kind <> 'listing' and (owner_user_id = auth.uid() or is_moderator());
  if not found then raise exception 'That dictionary isn''t yours.'; end if;
end;
$$;

revoke execute on function toggle_spark(uuid), send_message(uuid, uuid, text), read_thread(uuid, uuid),
  report_dictionary(uuid, uuid, text, text), review_dictionary(uuid, uuid, boolean), reports_waiting(),
  create_listing(uuid, text, jsonb, text[], text[]), save_listing(uuid, text, jsonb, text[]),
  set_listing_done(uuid, boolean), renew_listing(uuid),
  create_search(text, text, text, jsonb, text[], int, int), set_shape(uuid, text, jsonb, int, int) from public, anon;
grant execute on function toggle_spark(uuid), send_message(uuid, uuid, text), read_thread(uuid, uuid),
  report_dictionary(uuid, uuid, text, text), review_dictionary(uuid, uuid, boolean), reports_waiting(),
  create_listing(uuid, text, jsonb, text[], text[]), save_listing(uuid, text, jsonb, text[]),
  set_listing_done(uuid, boolean), renew_listing(uuid),
  create_search(text, text, text, jsonb, text[], int, int), set_shape(uuid, text, jsonb, int, int) to authenticated;

-- 7. Import search: live listings only (Mine shows all of yours), ranked
-- by fit, Official, Library adds plus sparks, then newest.

drop function if exists search_imports(text[], text, uuid, int, int, boolean);
create or replace function search_imports(
  p_labels text[],
  p_query text default '',
  p_except uuid default null,
  p_limit int default 12,
  p_offset int default 0,
  p_mine boolean default false
)
returns table (
  id uuid,
  name text,
  description text,
  labels text[],
  owner_user_id uuid,
  total bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with words as (
    select w from unnest(regexp_split_to_array(lower(trim(coalesce(p_query, ''))), '\s+')) as w
    where w <> ''
  ),
  pool as (
    select distinct d.id, d.name, d.description, d.page, d.page_status, d.owner_user_id, d.created_at, d.spark_count
    from dictionary_labels l
    join dictionaries d on d.id = l.dictionary_id
    where l.label = any (p_labels)
      and (p_except is null or d.id <> p_except)
      and (not p_mine or d.owner_user_id = auth.uid())
      and (p_mine or (d.hidden_at is null and d.closed_at is null and (d.expires_at is null or d.expires_at > now())))
  ),
  scored as (
    select p.*,
      (select array_agg(x.label order by x.label) from dictionary_labels x where x.dictionary_id = p.id) as all_labels
    from pool p
  ),
  matched as (
    select s.*
    from scored s
    where not exists (
      select 1 from words
      where not (
        lower(s.name) like '%' || w || '%'
        or lower(coalesce(s.description, '')) like '%' || w || '%'
        or exists (select 1 from unnest(s.all_labels) lab where lab like '%' || w || '%')
        or lower(coalesce(s.page::text, '')) like '%' || w || '%'
        or exists (select 1 from custom_entries e where e.dictionary_id = s.id and lower(e.data::text) like '%' || w || '%')
        or exists (
          select 1 from definitions df join terms t on t.id = df.term_id
          where df.dictionary_id = s.id and (lower(t.name) like '%' || w || '%' or lower(df.body) like '%' || w || '%')
        )
      )
    )
  )
  select m.id, m.name, m.description, coalesce(m.all_labels, '{}'), m.owner_user_id, count(*) over ()
  from matched m
  order by
    (select count(*) from words where lower(m.name) like '%' || w || '%') desc,
    coalesce(m.page_status = 'official', false) desc,
    library_count(m.id) + m.spark_count desc,
    m.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function search_imports(text[], text, uuid, int, int, boolean) to anon, authenticated;

-- 8. The three boards: photos and end dates ---------------------------------

update dictionaries set photo_limit = 1, lasts_days = null where address = 'idea-index-ds';
update dictionaries set photo_limit = 4, lasts_days = 30 where address = 'marketplace-ds';
update dictionaries set photo_limit = 0, lasts_days = 30 where address = 'job-match-ds';

-- 9. Move the old posts into listings ---------------------------------------
-- Every post that wasn't removed becomes a listing owned by its poster,
-- keeping its name, words, photos, labels, dates, sparks, comments, and
-- private replies. Safe to run twice: from_post_id remembers each one.

insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                          owner_user_id, display_kind, fields, page, by_name, photos, photo_limit, lasts_days,
                          expires_at, closed_at, hidden_at, created_at, from_post_id)
select
  'listing-' || substr(gen_random_uuid()::text, 1, 12),
  left(p.title, 80), null, 'instance', 'shared', 'public', 'approved', false, false,
  p.author_user_id, 'listing', b.fields,
  shape_values(b.fields, case b.address
    when 'idea-index-ds' then jsonb_build_object('problem', concat_ws(E'\n\n', nullif(p.body, ''), x.extra))
    when 'marketplace-ds' then jsonb_build_object('price', p.price, 'neighborhood', p.neighborhood,
                                                  'details', concat_ws(E'\n\n', nullif(p.body, ''), x.extra))
    else jsonb_build_object('pay', p.price, 'neighborhood', p.neighborhood,
                            'details', concat_ws(E'\n\n', nullif(p.body, ''), x.extra))
  end),
  p.author_name, p.photos[1:b.photo_limit], b.photo_limit, b.lasts_days,
  case when p.expires_at = 'infinity' then null else p.expires_at end,
  case when p.status = 'closed' then p.updated_at end,
  p.hidden_at, p.created_at, p.id
from posts p
join dictionaries b on b.id = p.dictionary_id and b.address in ('idea-index-ds', 'marketplace-ds', 'job-match-ds')
cross join lateral (
  select string_agg(initcap(replace(key, '_', ' ')) || ': ' || value, E'\n') as extra
  from jsonb_each_text(p.details)
  where value <> '' and jsonb_typeof(p.details -> key) <> 'array'
) x
where p.review is distinct from 'removed'
on conflict (from_post_id) do nothing;

-- Labels: the board's labels, the post's own, and its kind (for sale, free,
-- housing, looking).
insert into dictionary_labels (dictionary_id, label)
select d.id, l
from dictionaries d
join posts p on p.id = d.from_post_id
join dictionaries b on b.id = p.dictionary_id
cross join lateral unnest(clean_labels(b.shows || p.labels ||
  case when p.kind in ('Idea', 'Job') then '{}'::text[] else array[lower(p.kind)] end)) l
on conflict do nothing;

insert into dictionary_sparks (dictionary_id, user_id, created_at)
select d.id, v.user_id, v.created_at
from post_votes v join dictionaries d on d.from_post_id = v.post_id
on conflict do nothing;
update dictionaries d set spark_count = (select count(*) from dictionary_sparks s where s.dictionary_id = d.id)
where d.from_post_id is not null;

insert into dictionary_comments (dictionary_id, author_user_id, author_name, body, hidden_at, review, created_at)
select d.id, c.author_user_id, c.author_name, c.body, c.hidden_at, c.review, c.created_at
from post_comments c join dictionaries d on d.from_post_id = c.post_id
where c.review is distinct from 'removed'
  and not exists (select 1 from dictionary_comments x where x.dictionary_id = d.id and x.created_at = c.created_at and x.author_user_id = c.author_user_id);

insert into dictionary_messages (dictionary_id, asker_user_id, sender_user_id, sender_name, body, read_at, created_at)
select d.id, r.replier_user_id, r.sender_user_id, r.sender_name, r.body, now(), r.created_at
from post_replies r join dictionaries d on d.from_post_id = r.post_id
where not exists (select 1 from dictionary_messages x where x.dictionary_id = d.id and x.created_at = r.created_at and x.sender_user_id = r.sender_user_id);

-- The three boards are searches now.
update dictionaries set display_kind = 'search'
where address in ('idea-index-ds', 'marketplace-ds', 'job-match-ds');
