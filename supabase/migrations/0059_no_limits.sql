-- No limits for now (Sage, 2026-11-24): any number of orgs, notebooks,
-- groups and their members, ideas, profile entries, and nouns. Same
-- functions as before, minus the count checks. (The 100-messages-a-day
-- spam guard and the 3-reports-hide rule stay: they aren't limits on things.)

-- from 0048_profiles_not_boards.sql
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

-- from 0043_shared_notebooks.sql
create or replace function create_notebook(p_style text, p_name text, p_shared boolean default false)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_kind text := case p_style when 'night' then 'notes_list' when 'journal' then 'journal' end;
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_kind is null then raise exception 'Pick Night Notes or Journal.'; end if;
  if v_name is null then raise exception 'Give your notebook a name.'; end if;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind)
  values ('notebook-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance',
          case when p_shared then 'group' else 'personal' end,
          case when p_shared then 'members' else 'private' end,
          'approved', false, false, auth.uid(), v_kind)
  returning id into v_id;

  if p_shared then
    insert into dictionary_members (dictionary_id, user_id, role) values (v_id, auth.uid(), 'owner');
  end if;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;

-- from 0043_shared_notebooks.sql
create or replace function add_group_member(p_dictionary_id uuid, p_email text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not exists (
    select 1 from dictionary_members
    where dictionary_id = p_dictionary_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the owner can add people.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No Stardust DS account uses that email yet. Ask them to sign up first.';
  end if;

  insert into dictionary_members (dictionary_id, user_id, role)
  values (p_dictionary_id, v_user_id, 'member')
  on conflict do nothing;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (v_user_id, p_dictionary_id, true, now())
  on conflict (user_id, dictionary_id) do update set opted_in = true, opted_in_at = now();
end;
$$;

-- from 0054_things_and_search.sql
create or replace function create_idea(p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give your idea a name.'; end if;
  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in, owner_user_id, display_kind)
  values ('idea-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance', 'personal', 'public', 'approved', false, false, auth.uid(), 'journal')
  returning id into v_id;
  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;

-- from 0048_profiles_not_boards.sql
create or replace function profile_entries_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_age int; v_min int; v_max int;
begin
  if tg_op = 'INSERT' then
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

-- from 0050_my_words_and_inbox.sql
create or replace function my_words_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.owner_name := coalesce((select nullif(display_name, '') from profiles where id = new.owner_user_id), '');
  return new;
end;
$$;
