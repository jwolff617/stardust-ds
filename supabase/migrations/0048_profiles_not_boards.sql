-- Profiles, not boards (2026-11-22).
--
-- Matching is Sage searching profiles. A spark's profile holds entries of
-- four kinds, each offered or sought:
--   person    who you are, or who you hope to meet (romance, friendship,
--             business). Romance keeps the 18+ gate, age ranges both ways,
--             pause, and block.
--   idea      an idea you have, or one you're looking to join
--   job       work you offer, or work you're looking for (with pay)
--   resource  something you have, or need (free or for sale, and a price)
-- Every entry is a word, a body, and Place, People, Time, Visibility, like
-- everything else on the page. Public entries can be reported: three
-- reports hide one until a moderator clears or removes it.
--
-- Cut as dictionaries: Worthy (now one definition), Accounts/Resources,
-- Marketplace, Job Match, Idea Index, Manifesto Match, Core (its words move
-- into the Stardust dictionary). Their listings and manifestos move into
-- profile entries. Bet stories move into Bet Stories, one public journal.
-- What doesn't move (Worthy and Accounts entries) is hidden now and deleted
-- on or after 2026-12-22 by a later migration.
--
-- Renamed: Night Notes is Notes; Public Profile is Profile. Private
-- Profile stays as data behind Settings.
--
-- Needs 0046 and 0047.

-- 1. 18+, once per spark -----------------------------------------------------
-- The app checks the birth date before it writes one; only the time is kept.

create table if not exists adult_confirmations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  adult_at timestamptz not null default now()
);
alter table adult_confirmations enable row level security;
drop policy if exists "sparks read their own 18+" on adult_confirmations;
create policy "sparks read their own 18+" on adult_confirmations for select to authenticated using (user_id = auth.uid());
drop policy if exists "sparks confirm their own 18+" on adult_confirmations;
create policy "sparks confirm their own 18+" on adult_confirmations for insert to authenticated with check (user_id = auth.uid());

insert into adult_confirmations (user_id, adult_at)
select c.user_id, min(c.adult_at)
from board_confirmations c join dictionaries d on d.id = c.dictionary_id
where d.address = 'manifesto-match-ds' and c.adult_at is not null
group by c.user_id
on conflict (user_id) do nothing;

create or replace function is_adult(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from adult_confirmations where user_id = p_user); $$;
grant execute on function is_adult(uuid) to authenticated;

-- 2. Profile entries ----------------------------------------------------------

create table if not exists profile_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  -- The writer's name when they wrote it, so readers never need their profile.
  owner_name text not null default '',
  kind text not null check (kind in ('person', 'idea', 'job', 'resource')),
  side text not null default 'offer' check (side in ('offer', 'seek')),
  word text not null check (length(trim(word)) between 1 and 120),
  body text not null default '' check (length(body) <= 5000),
  place text not null default '' check (length(place) <= 120),
  people text not null default '' check (length(people) <= 300),
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  -- person: relationship (romance|friendship|business); romance also age,
  --   iam (woman|man|nonbinary), meet (women|men|everyone), age_min, age_max
  -- job: pay. resource: deal (free|sale|trade), price.
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and length(details::text) <= 4000),
  paused boolean not null default false,
  report_count integer not null default 0,
  hidden_at timestamptz,
  review text check (review in ('cleared', 'removed')),
  from_old uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'person' or details ->> 'relationship' in ('romance', 'friendship', 'business'))
);

-- Signed-out search reads this table too; these answer false for no one.
grant execute on function is_moderator() to anon;
grant execute on function is_blocked_between(uuid, uuid) to anon;

create index if not exists profile_entries_kind_idx on profile_entries (kind, created_at desc)
  where visibility = 'public' and hidden_at is null and not paused;
create index if not exists profile_entries_owner_idx on profile_entries (owner_user_id);

alter table profile_entries enable row level security;

-- Your own, always. Others' public ones, unless hidden, paused, blocked,
-- or romance (romance only shows through profile_matches, which checks fit).
drop policy if exists "sparks read profile entries" on profile_entries;
create policy "sparks read profile entries" on profile_entries for select
  using (
    owner_user_id = auth.uid()
    or is_moderator()
    or (
      visibility = 'public' and hidden_at is null and not paused
      and coalesce(details ->> 'relationship', '') <> 'romance'
      and (auth.uid() is null or not is_blocked_between(auth.uid(), owner_user_id))
    )
  );
drop policy if exists "sparks write their own entries" on profile_entries;
create policy "sparks write their own entries" on profile_entries for insert to authenticated
  with check (owner_user_id = auth.uid());
drop policy if exists "sparks edit their own entries" on profile_entries;
create policy "sparks edit their own entries" on profile_entries for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
drop policy if exists "sparks delete their own entries" on profile_entries;
create policy "sparks delete their own entries" on profile_entries for delete to authenticated
  using (owner_user_id = auth.uid());

-- Checks every write: romance needs 18+ and sane ages; a writer can't set
-- their own report state; the name comes from their profile.
create or replace function profile_entries_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_age int; v_min int; v_max int;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from profile_entries where owner_user_id = new.owner_user_id) >= 200 then
      raise exception 'You have 200 entries. Delete one to make another.';
    end if;
    new.report_count := 0; new.hidden_at := null; new.review := null;
  elsif auth.uid() is not null and not is_moderator() then
    new.report_count := old.report_count; new.hidden_at := old.hidden_at; new.review := old.review;
    new.owner_user_id := old.owner_user_id; new.from_old := old.from_old; new.created_at := old.created_at;
  end if;
  if auth.uid() is not null then
    new.owner_name := coalesce((select nullif(display_name, '') from profiles where id = new.owner_user_id), new.owner_name, '');
  end if;
  new.updated_at := now();
  if new.kind <> 'person' and new.details ? 'relationship' then
    new.details := new.details - 'relationship';
  end if;
  if new.details ->> 'relationship' = 'romance' then
    if auth.uid() is not null and not is_adult(new.owner_user_id) then
      raise exception 'Romance is 18 and older. Confirm your age first.';
    end if;
    begin
      v_age := (new.details ->> 'age')::int;
      v_min := (new.details ->> 'age_min')::int;
      v_max := (new.details ->> 'age_max')::int;
    exception when others then
      raise exception 'Romance needs your age and the ages you''re open to, as numbers.';
    end;
    if v_age is null or v_min is null or v_max is null then
      raise exception 'Romance needs your age and the ages you''re open to.';
    end if;
    if v_age < 18 or v_min < 18 or v_max > 120 or v_min > v_max then
      raise exception 'Check the ages: 18 and up, and the first should be the lower one.';
    end if;
    if coalesce(new.details ->> 'iam', '') not in ('woman', 'man', 'nonbinary')
       or coalesce(new.details ->> 'meet', '') not in ('women', 'men', 'everyone') then
      raise exception 'Romance needs who you are (woman, man, nonbinary) and who you hope to meet (women, men, everyone).';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_entries_guard on profile_entries;
create trigger profile_entries_guard before insert or update on profile_entries
  for each row execute function profile_entries_guard();

-- 3. Reports ------------------------------------------------------------------

create table if not exists profile_entry_reports (
  entry_id uuid not null references profile_entries(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (length(reason) <= 300),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (entry_id, reporter_user_id)
);
alter table profile_entry_reports enable row level security;
drop policy if exists "sparks report entries" on profile_entry_reports;
create policy "sparks report entries" on profile_entry_reports for insert to authenticated
  with check (reporter_user_id = auth.uid());
drop policy if exists "moderators read entry reports" on profile_entry_reports;
create policy "moderators read entry reports" on profile_entry_reports for select to authenticated
  using (is_moderator() or reporter_user_id = auth.uid());

-- Three open reports hide an entry until a moderator decides.
create or replace function profile_entry_reports_count()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_open int;
begin
  select count(*) into v_open from profile_entry_reports where entry_id = new.entry_id and resolved_at is null;
  update profile_entries
     set report_count = v_open,
         hidden_at = case when v_open >= 3 and review is distinct from 'cleared' then coalesce(hidden_at, now()) else hidden_at end
   where id = new.entry_id;
  return new;
end;
$$;
drop trigger if exists profile_entry_reports_count on profile_entry_reports;
create trigger profile_entry_reports_count after insert on profile_entry_reports
  for each row execute function profile_entry_reports_count();

create or replace function review_profile_entry(p_id uuid, p_remove boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only.'; end if;
  update profile_entries
     set review = case when p_remove then 'removed' else 'cleared' end,
         hidden_at = case when p_remove then coalesce(hidden_at, now()) else null end
   where id = p_id;
  update profile_entry_reports set resolved_at = now() where entry_id = p_id and resolved_at is null;
end;
$$;
grant execute on function review_profile_entry(uuid, boolean) to authenticated;

create or replace function profile_entry_reports_waiting()
returns table (entry_id uuid, word text, body text, owner_name text, hidden boolean, reports bigint, reasons text[])
language sql stable security definer set search_path = public
as $$
  select e.id, e.word, e.body, e.owner_name, e.hidden_at is not null, count(*), array_agg(distinct r.reason)
  from profile_entry_reports r join profile_entries e on e.id = r.entry_id
  where r.resolved_at is null and is_moderator()
  group by e.id
  order by 5 desc, 6 desc
  limit 100;
$$;
grant execute on function profile_entry_reports_waiting() to authenticated;

-- 4. Say hello: private messages between an entry's writer and one other
--    spark, and phone swaps on those threads (thread "e:<entry>:<asker>").

create table if not exists profile_entry_messages (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references profile_entries(id) on delete cascade,
  asker_user_id uuid not null references auth.users(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default '',
  body text not null check (length(trim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists profile_entry_messages_thread_idx on profile_entry_messages (entry_id, asker_user_id, created_at);
alter table profile_entry_messages enable row level security;

create or replace function entry_owner(p_entry uuid)
returns uuid
language sql stable security definer set search_path = public
as $$ select owner_user_id from profile_entries where id = p_entry; $$;
grant execute on function entry_owner(uuid) to authenticated;

drop policy if exists "both sides read a hello thread" on profile_entry_messages;
create policy "both sides read a hello thread" on profile_entry_messages for select to authenticated
  using (asker_user_id = auth.uid() or entry_owner(entry_id) = auth.uid());

-- Writes go through say_hello, which checks the asker can see the entry.
create or replace function say_hello(p_entry uuid, p_body text, p_asker uuid default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid := entry_owner(p_entry);
  v_asker uuid := coalesce(p_asker, auth.uid());
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_owner is null then raise exception 'That entry is gone.'; end if;
  if trim(coalesce(p_body, '')) = '' then raise exception 'Write a few words first.'; end if;
  -- The writer answers in an asker's thread; anyone else starts their own.
  if auth.uid() <> v_owner then v_asker := auth.uid(); end if;
  if v_asker = v_owner then raise exception 'That''s your own entry.'; end if;
  if is_blocked_between(v_owner, v_asker) then raise exception 'You can''t message each other.'; end if;
  if auth.uid() = v_asker and not exists (
    select 1 from profile_entries e where e.id = p_entry and e.hidden_at is null and not e.paused and e.visibility = 'public'
  ) then raise exception 'That entry isn''t up right now.'; end if;
  if (select count(*) from profile_entry_messages where sender_user_id = auth.uid() and created_at > now() - interval '1 day') >= 100 then
    raise exception 'That''s a lot of messages today. Try again tomorrow.';
  end if;
  insert into profile_entry_messages (entry_id, asker_user_id, sender_user_id, sender_name, body)
  values (p_entry, v_asker, auth.uid(), coalesce((select nullif(display_name, '') from profiles where id = auth.uid()), ''), left(trim(p_body), 2000))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function say_hello(uuid, text, uuid) to authenticated;

-- Phone swaps accept entry threads too.
alter table contact_swaps drop constraint if exists contact_swaps_thread_check;
alter table contact_swaps add constraint contact_swaps_thread_check
  check (thread ~ '^[dpe]:[0-9a-f-]{36}:[0-9a-f-]{36}$');

-- 5. Matching -----------------------------------------------------------------
-- Others' public entries of one kind, ranked by the words they share with
-- yours. Ideas, jobs, and resources pair offers with seeks when you have
-- entries of that kind. People match on the same relationship; romance
-- only both ways (18+, an active romance entry of your own, ages and who
-- you hope to meet fit both directions).

create or replace function stardust_words(p_text text)
returns text[]
language sql immutable
as $$
  select coalesce(array_agg(distinct w), '{}')
  from regexp_split_to_table(lower(coalesce(p_text, '')), '[^a-z0-9]+') w
  where length(w) > 3
    and w not in ('that', 'this', 'with', 'from', 'have', 'what', 'your', 'about', 'they', 'them', 'there', 'their',
                  'would', 'could', 'should', 'want', 'just', 'like', 'into', 'some', 'more', 'than', 'when', 'will', 'been');
$$;

drop function if exists profile_matches(text, text, text, text, int);
create or replace function profile_matches(
  p_kind text,
  p_query text default '',
  p_relationship text default '',
  p_place text default '',
  p_limit int default 30
)
returns table (id uuid, kind text, side text, word text, body text, place text, people text, owner_name text,
               details jsonb, created_at timestamptz, shared text[])
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_mine profile_entries%rowtype;
  v_words text[];
  v_sides text[];
begin
  if v_me is null then raise exception 'Log in to match.'; end if;
  if p_kind not in ('person', 'idea', 'job', 'resource') then raise exception 'Match person, idea, job, or resource.'; end if;

  -- Your words: what you asked, plus your own entries of this kind.
  select stardust_words(coalesce(p_query, '') || ' ' || coalesce(string_agg(e.word || ' ' || e.body, ' '), ''))
    into v_words
  from profile_entries e
  where e.owner_user_id = v_me and e.kind = p_kind and not e.paused
    and (p_kind <> 'person' or coalesce(p_relationship, '') = '' or e.details ->> 'relationship' = p_relationship);

  -- Offers meet seeks. With no entries of your own, both sides show.
  select array_agg(distinct case when e.side = 'offer' then 'seek' else 'offer' end) into v_sides
  from profile_entries e where e.owner_user_id = v_me and e.kind = p_kind and not e.paused;
  if p_kind = 'person' or v_sides is null then v_sides := array['offer', 'seek']; end if;

  if p_kind = 'person' and p_relationship = 'romance' then
    if not is_adult(v_me) then raise exception 'Romance is 18 and older. Confirm your age first.'; end if;
    select * into v_mine from profile_entries e
    where e.owner_user_id = v_me and e.kind = 'person' and e.details ->> 'relationship' = 'romance'
      and not e.paused and e.hidden_at is null
    order by e.updated_at desc limit 1;
    if not found then raise exception 'Put up your own romance entry first. You see others while yours is up.'; end if;
  end if;

  return query
  select e.id, e.kind, e.side, e.word, e.body, e.place, e.people, e.owner_name, e.details, e.created_at,
         array(select unnest(stardust_words(e.word || ' ' || e.body)) intersect select unnest(v_words)) as shared
  from profile_entries e
  where e.kind = p_kind
    and e.owner_user_id <> v_me
    and e.visibility = 'public' and e.hidden_at is null and not e.paused
    and e.side = any (v_sides)
    and not is_blocked_between(v_me, e.owner_user_id)
    and (coalesce(p_place, '') = '' or e.place ilike '%' || trim(p_place) || '%')
    and (p_kind <> 'person' or coalesce(p_relationship, '') = '' or e.details ->> 'relationship' = p_relationship)
    -- Romance: only when both of you fit what the other is open to.
    and (
      coalesce(e.details ->> 'relationship', '') <> 'romance'
      or (
        p_relationship = 'romance'
        and (e.details ->> 'age')::int between (v_mine.details ->> 'age_min')::int and (v_mine.details ->> 'age_max')::int
        and (v_mine.details ->> 'age')::int between (e.details ->> 'age_min')::int and (e.details ->> 'age_max')::int
        and (v_mine.details ->> 'meet' = 'everyone'
             or (v_mine.details ->> 'meet' = 'women' and e.details ->> 'iam' = 'woman')
             or (v_mine.details ->> 'meet' = 'men' and e.details ->> 'iam' = 'man'))
        and (e.details ->> 'meet' = 'everyone'
             or (e.details ->> 'meet' = 'women' and v_mine.details ->> 'iam' = 'woman')
             or (e.details ->> 'meet' = 'men' and v_mine.details ->> 'iam' = 'man'))
      )
    )
  order by cardinality(array(select unnest(stardust_words(e.word || ' ' || e.body)) intersect select unnest(v_words))) desc,
           e.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;
grant execute on function profile_matches(text, text, text, text, int) to authenticated;

-- 6. Organizations: a body anyone can read, a type, and the four fields ---------

alter table organizations drop constraint if exists organizations_kind_check;
alter table organizations add constraint organizations_kind_check
  check (kind in ('nonprofit', 'business', 'government', 'other'));
alter table organizations drop constraint if exists organizations_about_check;
alter table organizations add constraint organizations_about_check check (length(about) <= 5000);
alter table organizations
  add column if not exists people text not null default '' check (length(people) <= 300),
  add column if not exists visibility text not null default 'public' check (visibility in ('private', 'public')),
  add column if not exists updated_at timestamptz not null default now();

create or replace function is_organization_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from organization_members where organization_id = p_org and user_id = auth.uid()); $$;
grant execute on function is_organization_member(uuid) to authenticated;

-- Create and save take the whole definition: type, body, and the four fields.
drop function if exists create_organization(text, text, text, text);
create or replace function create_organization(p_name text, p_kind text, p_website text, p_about text,
  p_place text default '', p_people text default '', p_visibility text default 'public')
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_slug text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give your organization a name.'; end if;
  if (select count(*) from organization_members where user_id = auth.uid() and role = 'admin') >= 3 then
    raise exception 'You run 3 organizations already.';
  end if;
  v_slug := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 30);
  if length(v_slug) < 2 then v_slug := 'org'; end if;
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  insert into organizations (slug, name, kind, website, about, neighborhood, people, visibility)
  values (v_slug, v_name,
          case when p_kind in ('nonprofit', 'business', 'government', 'other') then p_kind else 'other' end,
          left(trim(coalesce(p_website, '')), 200), left(trim(coalesce(p_about, '')), 5000),
          left(trim(coalesce(p_place, '')), 60), left(trim(coalesce(p_people, '')), 300),
          case when p_visibility = 'private' then 'private' else 'public' end)
  returning id into v_id;
  insert into organization_members (organization_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return v_id;
end;
$$;
grant execute on function create_organization(text, text, text, text, text, text, text) to authenticated;

drop function if exists save_organization(uuid, text, text, text, text);
create or replace function save_organization(p_id uuid, p_name text, p_kind text, p_website text, p_about text,
  p_place text default null, p_people text default null, p_visibility text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
begin
  if not is_org_admin(p_id) then raise exception 'Only its admin can change it.'; end if;
  if v_name is null then raise exception 'Give your organization a name.'; end if;
  update organizations
  set name = v_name,
      kind = case when p_kind in ('nonprofit', 'business', 'government', 'other') then p_kind else kind end,
      website = left(trim(coalesce(p_website, '')), 200),
      about = left(trim(coalesce(p_about, '')), 5000),
      neighborhood = coalesce(left(trim(p_place), 60), neighborhood),
      people = coalesce(left(trim(p_people), 300), people),
      visibility = case when p_visibility in ('private', 'public') then p_visibility else visibility end,
      updated_at = now()
  where id = p_id;
end;
$$;
grant execute on function save_organization(uuid, text, text, text, text, text, text, text) to authenticated;

drop policy if exists "sparks read organizations" on organizations;
create policy "sparks read organizations" on organizations for select to authenticated
  using (visibility = 'public' or is_organization_member(id) or is_moderator());

-- 7. Bet Stories: one public journal ------------------------------------------

insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind)
values ('bet-stories', 'Bet Stories',
        'One journal every spark can write in and read: the bets, what happened, and what you learned.',
        'topical', 'shared', 'public', 'approved', false, false, 'journal')
on conflict (address) do update set name = excluded.name, description = excluded.description, display_kind = 'journal', status = 'approved';

create or replace function bet_stories_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from dictionaries where address = 'bet-stories'; $$;
grant execute on function bet_stories_id() to authenticated;

drop policy if exists "sparks read bet stories" on journal_entries;
create policy "sparks read bet stories" on journal_entries for select to authenticated
  using (dictionary_id = bet_stories_id() and not is_blocked_between(auth.uid(), owner_user_id));
drop policy if exists "sparks write bet stories" on journal_entries;
create policy "sparks write bet stories" on journal_entries for insert to authenticated
  with check (owner_user_id = auth.uid() and dictionary_id = bet_stories_id());
drop policy if exists "moderators remove bet stories" on journal_entries;
create policy "moderators remove bet stories" on journal_entries for delete to authenticated
  using (dictionary_id = bet_stories_id() and is_moderator());

insert into journal_entries (dictionary_id, owner_user_id, body, created_at)
select bet_stories_id(), b.owner_user_id,
       to_char(b.occurred_on, 'Mon DD, YYYY') || ' · ' || initcap(b.outcome) || E'\n\n' || b.body,
       b.created_at
from bet_stories b
where not exists (
  select 1 from journal_entries j
  where j.dictionary_id = bet_stories_id() and j.owner_user_id = b.owner_user_id and j.created_at = b.created_at
);

-- Everyone gets Bet Stories in their list.
insert into user_dictionaries (user_id, dictionary_id, opted_in)
select p.id, bet_stories_id(), true from profiles p
on conflict (user_id, dictionary_id) do update set opted_in = true;

-- 8. Move manifestos and listings into profile entries -------------------------

-- Manifestos: Friends, Business Partners, Dating become person entries.
insert into profile_entries (owner_user_id, owner_name, kind, side, word, body, place, visibility, details, paused,
                             hidden_at, review, from_old, created_at)
select p.author_user_id, p.author_name, 'person', 'offer', p.title,
       concat_ws(E'\n\n', nullif(p.body, ''),
         nullif((select string_agg((l ->> 'word') || ': ' || coalesce(l ->> 'text', ''), E'\n')
                 from jsonb_array_elements(case when jsonb_typeof(p.details -> 'lines') = 'array' then p.details -> 'lines' else '[]'::jsonb end) l), '')),
       p.neighborhood, 'public',
       case p.kind
         when 'Friends' then '{"relationship":"friendship"}'::jsonb
         when 'Business Partners' then '{"relationship":"business"}'::jsonb
         else jsonb_build_object(
           'relationship', 'romance',
           'age', p.details ->> 'age',
           'iam', case p.details ->> 'iam' when 'A woman' then 'woman' when 'A man' then 'man' else 'nonbinary' end,
           'meet', lower(coalesce(p.details ->> 'meet', 'everyone')),
           'age_min', p.details ->> 'age_min',
           'age_max', p.details ->> 'age_max')
       end,
       p.status = 'closed', p.hidden_at, p.review, p.id, p.created_at
from posts p join dictionaries d on d.id = p.dictionary_id
where d.address = 'manifesto-match-ds' and p.review is distinct from 'removed'
on conflict (from_old) do nothing;

-- Listings: ideas, jobs, and resources.
insert into profile_entries (owner_user_id, owner_name, kind, side, word, body, place, visibility, details,
                             hidden_at, review, from_old, created_at)
select l.owner_user_id, coalesce(l.by_name, ''), m.kind, m.side, left(l.name, 120),
       left(coalesce((select string_agg(v.key || ': ' || v.value, E'\n')
                      from jsonb_each_text(coalesce(l.page, '{}'::jsonb)) v
                      where v.value <> '' and lower(v.key) not in ('neighborhood', 'price', 'pay')), ''), 5000),
       left(coalesce(l.page ->> 'neighborhood', l.page ->> 'Neighborhood', p.neighborhood, ''), 120),
       'public',
       case m.kind
         when 'job' then jsonb_strip_nulls(jsonb_build_object('pay', coalesce(nullif(p.price, ''), l.page ->> 'pay', l.page ->> 'Pay')))
         when 'resource' then jsonb_strip_nulls(jsonb_build_object(
           'deal', case p.kind when 'Free' then 'free' when 'Trade' then 'trade' when 'For Sale' then 'sale' else null end,
           'price', coalesce(nullif(p.price, ''), l.page ->> 'price', l.page ->> 'Price')))
         else '{}'::jsonb
       end,
       l.hidden_at, l.review, l.id, l.created_at
from dictionaries l
left join posts p on p.id = l.from_post_id
left join dictionaries b on b.id = p.dictionary_id
cross join lateral (
  select
    case
      when b.address = 'job-match-ds' then 'job'
      when b.address = 'idea-index-ds' then 'idea'
      when b.address = 'marketplace-ds' then 'resource'
      when exists (select 1 from dictionary_labels x where x.dictionary_id = l.id and x.label in ('job', 'jobs', 'work', 'gig')) then 'job'
      when exists (select 1 from dictionary_labels x where x.dictionary_id = l.id and x.label in ('idea', 'ideas')) then 'idea'
      else 'resource'
    end as kind,
    case when p.kind in ('Looking', 'Wanted') then 'seek' else 'offer' end as side
) m
where l.display_kind = 'listing' and l.closed_at is null and l.review is distinct from 'removed'
  and l.owner_user_id is not null
on conflict (from_old) do nothing;

-- 9. Core's words move into the Stardust dictionary ---------------------------

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select c.term_id, s.id, c.body, c.part_of_speech
from definitions c
join dictionaries core on core.id = c.dictionary_id and core.address = 'core'
join terms t on t.id = c.term_id
cross join (select id from dictionaries where address = 'stardust') s
where t.name not in ('Marketplace', 'Job Match', 'Manifesto Match', 'Worthy')
on conflict (term_id, dictionary_id) do nothing;

insert into terms (name) values ('Worthy'), ('Profile Entry'), ('Organization'), ('Bet Stories'), ('Notes')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, 'noun'
from (values
  ('Worthy', 'Saving half of your winnings.'),
  ('Profile Entry', 'One thing on your profile: who you are or who you hope to meet, an idea, a job, or a resource. Offered or sought, public or private. Sage matches entries by the words they share.'),
  ('Organization', 'A business, government, nonprofit, or other group of sparks, defined in its own words: its mission, announcements, how to reach it. Anyone can make one. Official means a moderator checked it''s real.'),
  ('Bet Stories', 'One journal every spark can write in and read: the bets, what happened, and what you learned.'),
  ('Notes', 'Short notes that live for a time: a day, a week, a month, a year, a decade, or a life. When the time is up, a note lets go.')
) as v(name, body)
join terms t on t.name = v.name
join dictionaries d on d.address = 'stardust'
on conflict (term_id, dictionary_id) do update set body = excluded.body;

-- 10. Cut: hidden now, deleted on or after 2026-12-22 --------------------------
-- 'rejected' hides a dictionary and every copy from everyone; the rows stay
-- until the delete migration.

update dictionaries set status = 'rejected', locked = false
where address in ('core', 'worthy-ds', 'accounts-ds', 'marketplace-ds', 'job-match-ds', 'idea-index-ds', 'manifesto-match-ds')
   or template_id in (select id from dictionaries where address in ('worthy-ds', 'accounts-ds'))
   or display_kind = 'listing'
   or display_kind = 'search';

update user_dictionaries set opted_in = false
where dictionary_id in (select id from dictionaries where status = 'rejected');


-- 11. Names -------------------------------------------------------------------

update dictionaries set name = 'Notes', description = 'Short notes that live for a time: a day to a life. When the time is up, a note lets go.'
where address = 'night-ds';
update dictionaries set name = regexp_replace(name, 'Night (Notes|DS)$', 'Notes')
where name ~ 'Night (Notes|DS)$';

update dictionaries set name = 'Profile' where address = 'public-profile';
update dictionaries set name = regexp_replace(name, 'Public Profile$', 'Profile')
where name ~ 'Public Profile$';

-- 12. Search: profile entries and organizations replace listings ---------------

create or replace function stardust_search(
  p_word text default '',
  p_body text default '',
  p_place text default '',
  p_people text default '',
  p_after timestamptz default null,
  p_before timestamptz default null,
  p_visibility text default '',
  p_limit int default 30
)
returns table (kind text, id uuid, word text, body text, place text, people text, visibility text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  with found as (
    select 'word'::text as kind, def.id, t.name as word, def.body, ''::text as place, ''::text as people,
           'public'::text as visibility, def.created_at
    from definitions def
    join terms t on t.id = def.term_id
    join dictionaries d on d.id = def.dictionary_id
    where d.status = 'approved' and d.scope = 'shared' and d.kind <> 'instance'

    union all
    select 'note', n.id, left(regexp_replace(n.body, '\s+', ' ', 'g'), 60), n.body, n.place,
           nullif(concat_ws(', ', nullif(n.people, ''), p.display_name), ''),
           case when d.scope = 'group' then 'group' else n.visibility end, n.created_at
    from notes n
    join dictionaries d on d.id = n.dictionary_id
    left join profiles p on p.id = n.owner_user_id

    union all
    select 'journal', j.id, d.name, j.body, j.place,
           nullif(concat_ws(', ', nullif(j.people, ''), p.display_name), ''),
           case when d.scope = 'group' then 'group' when d.address = 'bet-stories' then 'public' else 'private' end, j.created_at
    from journal_entries j
    join dictionaries d on d.id = j.dictionary_id
    left join profiles p on p.id = j.owner_user_id

    union all
    -- Profile entries: people, ideas, jobs, resources
    select e.kind, e.id, e.word, e.body, e.place,
           nullif(concat_ws(', ', nullif(e.people, ''), nullif(e.owner_name, '')), ''),
           e.visibility, e.created_at
    from profile_entries e
    where e.hidden_at is null

    union all
    select 'profile', pr.id, coalesce(nullif(pr.display_name, ''), 'A spark'),
           string_agg(f.name || ': ' || f.value, ' · ' order by f.position), '', pr.display_name, 'public', min(f.created_at)
    from profile_fields f
    join profiles pr on pr.id = f.owner_user_id
    where f.visibility = 'public' and f.value <> ''
    group by pr.id, pr.display_name

    union all
    select 'organization', o.id, o.name, concat_ws(' · ', o.kind, nullif(o.about, '')), o.neighborhood, o.people, o.visibility, o.created_at
    from organizations o
  )
  select f.kind, f.id, f.word, f.body, f.place, coalesce(f.people, ''), f.visibility, f.created_at
  from found f
  where (coalesce(p_word, '') = '' or f.word ilike '%' || trim(p_word) || '%')
    and stardust_has_words(f.word || ' ' || f.body, p_body)
    and (coalesce(p_place, '') = '' or f.place ilike '%' || trim(p_place) || '%' or f.body ilike '%' || trim(p_place) || '%')
    and (coalesce(p_people, '') = '' or coalesce(f.people, '') ilike '%' || trim(p_people) || '%')
    and (p_after is null or f.created_at >= p_after)
    and (p_before is null or f.created_at < p_before)
    and (coalesce(p_visibility, '') = '' or f.visibility = lower(trim(p_visibility)))
  order by
    (lower(f.word) = lower(trim(coalesce(p_word, '')))) desc,
    (f.word ilike trim(coalesce(p_word, '')) || '%') desc,
    f.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- 13. New sparks start with Stardust and Bet Stories (Core is gone) ---------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');

  insert into user_dictionaries (user_id, dictionary_id, opted_in)
  select new.id, id, true from dictionaries where address in ('stardust', 'bet-stories');

  perform provision_profiles(new.id, new.raw_user_meta_data->>'display_name', new.email);
  return new;
end;
$$;
