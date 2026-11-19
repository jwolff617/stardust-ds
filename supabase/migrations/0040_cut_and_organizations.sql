-- Simplify (2026-11-19): delete Lockers, Lockers Admin, Idea House,
-- Business Pages, and Wolffie Games for good, data and all. Move Official
-- off pages and onto organizations.
--
-- Organizations: anyone can make one and start writing right away, the
-- same as a person. The Official tag comes only when a
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

-- 4. Organizations. The table is from 0022 (Sage added them by hand, and
--    members post as the organization). Now anyone can make one and is its
--    admin. It writes right away. Official comes only when a moderator
--    approves. `verified` stays in step with Official so posts keep working.

alter table organizations
  add column if not exists status text not null default 'unverified'
    check (status in ('unverified', 'applied', 'official')),
  add column if not exists reviewed_at timestamptz;

update organizations set status = 'official' where verified and status <> 'official';

create or replace function is_official(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from organization_members m join organizations o on o.id = m.organization_id
    where m.user_id = p_user and o.status = 'official'
  );
$$;

create or replace function is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from organization_members where organization_id = p_org and user_id = auth.uid() and role = 'admin');
$$;

-- Make an organization. You're its admin. Up to 3 each.
create or replace function create_organization(p_name text, p_kind text, p_website text, p_about text)
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
  insert into organizations (slug, name, kind, website, about)
  values (v_slug, v_name,
          case when p_kind in ('nonprofit', 'business', 'government') then p_kind else 'nonprofit' end,
          left(trim(coalesce(p_website, '')), 200), left(trim(coalesce(p_about, '')), 1000))
  returning id into v_id;
  insert into organization_members (organization_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return v_id;
end;
$$;

-- Change its name and words. Admins only. Status stays.
create or replace function save_organization(p_id uuid, p_name text, p_kind text, p_website text, p_about text)
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
      kind = case when p_kind in ('nonprofit', 'business', 'government') then p_kind else kind end,
      website = left(trim(coalesce(p_website, '')), 200),
      about = left(trim(coalesce(p_about, '')), 1000)
  where id = p_id;
end;
$$;

create or replace function delete_organization(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_org_admin(p_id) then raise exception 'Only its admin can delete it.'; end if;
  delete from organizations where id = p_id;
end;
$$;

create or replace function apply_official(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_org_admin(p_id) then raise exception 'Only its admin can apply.'; end if;
  update organizations set status = 'applied' where id = p_id and status = 'unverified';
  if not found then raise exception 'Already applied.'; end if;
end;
$$;

-- A moderator approves (Official) or sends back. Also takes Official away.
create or replace function review_organization(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Only a moderator can do that.'; end if;
  update organizations
  set status = case when p_approve then 'official' else 'unverified' end,
      verified = p_approve,
      reviewed_at = now()
  where id = p_id;
  if not found then raise exception 'Organization not found.'; end if;
end;
$$;

-- Admins see who's in their organization.
drop policy if exists "admins see their members" on organization_members;
create policy "admins see their members"
  on organization_members for select to authenticated
  using (is_org_admin(organization_id));

revoke execute on function create_organization(text, text, text, text), save_organization(uuid, text, text, text, text),
  delete_organization(uuid), apply_official(uuid), review_organization(uuid, boolean), is_org_admin(uuid) from public, anon;
grant execute on function create_organization(text, text, text, text), save_organization(uuid, text, text, text, text),
  delete_organization(uuid), apply_official(uuid), review_organization(uuid, boolean), is_org_admin(uuid) to authenticated;
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
