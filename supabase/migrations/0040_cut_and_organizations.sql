-- Simplify (2026-11-19): delete Lockers, Lockers Admin, Idea House,
-- Business Pages, and Wolffie Games for good, data and all. Move Official
-- off pages and onto organizations.
--
-- Organizations: anyone can say they're an organization and start writing
-- right away, the same as a person. The Official tag comes only when a
-- moderator approves them. Official organizations rank first in searches.
--
-- Needs 0039.

-- 1. Delete the dictionaries. Copies, posts, labels, members, and their
--    tables' rows go with them (on delete cascade).

delete from dictionaries
where display_kind in ('lockers', 'lockers_admin', 'wolffie_games', 'idea_house', 'page')
   or instance_display_kind in ('lockers_admin', 'wolffie_games', 'page')
   or address in ('lockers', 'lockers-admin-ds', 'idea-house-ds', 'wolffie-games-ds', 'business-page');

-- 2. Their tables and functions.

drop table if exists lockers_attendance, lockers_bars, lockers_lockers, lockers_participants, lockers_posts cascade;
drop table if exists wolffie_packets, wolffie_themes cascade;
drop table if exists idea_house_decisions cascade;

drop function if exists lockers_admin_single_group() cascade;
drop function if exists is_lockers_admin() cascade;
drop function if exists create_page(text);
drop function if exists save_page(uuid, text, text, jsonb);
drop function if exists apply_official(uuid);
drop function if exists review_page(uuid, boolean);

drop policy if exists "pages are readable when official" on dictionaries;
drop policy if exists "labels on official pages are readable" on dictionary_labels;

-- Names are free again: with pages gone, nothing guards an Official name.
drop trigger if exists dictionaries_official_names on dictionaries;
drop function if exists guard_official_names();

update dictionaries set page_status = null where page_status is not null;

-- 3. The kinds left.

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school',
                            'notepad', 'contacts', 'birthdays',
                            'marketplace', 'jobs', 'ideas', 'manifesto', 'custom',
                            'listing', 'search'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school',
                                     'notepad', 'contacts', 'birthdays',
                                     'marketplace', 'jobs', 'ideas', 'manifesto'));

-- 4. Organizations.

create table if not exists organizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  website text not null default '' check (length(website) <= 200),
  about text not null default '' check (length(about) <= 500),
  status text not null default 'unverified' check (status in ('unverified', 'applied', 'official')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table organizations enable row level security;

-- Who's an organization, and who's Official, is public to sparks.
-- Writes go only through the functions below.
drop policy if exists "sparks read organizations" on organizations;
create policy "sparks read organizations"
  on organizations for select
  to authenticated
  using (true);

create or replace function is_official(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from organizations where user_id = p_user and status = 'official');
$$;

-- Say you're an organization, or change its name and words. Changing
-- them keeps your status.
create or replace function save_organization(p_name text, p_website text, p_about text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give your organization a name.'; end if;
  insert into organizations (user_id, name, website, about)
  values (auth.uid(), v_name, left(trim(coalesce(p_website, '')), 200), left(trim(coalesce(p_about, '')), 500))
  on conflict (user_id) do update
    set name = excluded.name, website = excluded.website, about = excluded.about;
end;
$$;

-- Stop being an organization. Official goes with it.
create or replace function remove_organization()
returns void
language sql
security definer set search_path = public
as $$
  delete from organizations where user_id = auth.uid();
$$;

create or replace function apply_official()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update organizations set status = 'applied' where user_id = auth.uid() and status = 'unverified';
  if not found then raise exception 'Save your organization first, or you''ve already applied.'; end if;
end;
$$;

-- A moderator approves (Official) or sends back (unverified). A moderator
-- can also take Official away.
create or replace function review_organization(p_user uuid, p_approve boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Only a moderator can do that.'; end if;
  update organizations
  set status = case when p_approve then 'official' else 'unverified' end, reviewed_at = now()
  where user_id = p_user;
  if not found then raise exception 'Organization not found.'; end if;
end;
$$;

revoke execute on function save_organization(text, text, text), remove_organization(), apply_official(),
  review_organization(uuid, boolean) from public, anon;
grant execute on function save_organization(text, text, text), remove_organization(), apply_official(),
  review_organization(uuid, boolean) to authenticated;
grant execute on function is_official(uuid) to anon, authenticated;

-- 5. Searches rank Official organizations first, after name matches.

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
    select distinct d.id, d.name, d.description, d.page, d.owner_user_id, d.created_at, d.spark_count
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
    is_official(m.owner_user_id) desc,
    library_count(m.id) + m.spark_count desc,
    m.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function search_imports(text[], text, uuid, int, int, boolean) to anon, authenticated;
