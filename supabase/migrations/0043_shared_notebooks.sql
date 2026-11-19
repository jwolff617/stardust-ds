-- Shared notebooks (2026-11-19). A notebook can be Just me or Shared. A
-- shared notebook is a group: its owner adds people by email, up to 30
-- in all. Everyone in it reads every note or entry, with the writer's
-- name, and writes their own. You change or delete only what you wrote.
-- Invite only: no public groups, nothing to browse.
--
-- Needs 0042.

-- 1. New notebook: Night Notes or Journal, Just me or Shared.

drop function if exists create_notebook(text, text);
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
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and address like 'notebook-%') >= 30 then
    raise exception 'You have 30 notebooks. Delete one to make another.';
  end if;

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

revoke execute on function create_notebook(text, text, boolean) from public, anon;
grant execute on function create_notebook(text, text, boolean) to authenticated;

-- 2. Up to 30 people in a group, owner included.

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

  if not exists (select 1 from dictionary_members where dictionary_id = p_dictionary_id and user_id = v_user_id)
     and (select count(*) from dictionary_members where dictionary_id = p_dictionary_id) >= 30 then
    raise exception 'A shared notebook holds up to 30 people.';
  end if;

  insert into dictionary_members (dictionary_id, user_id, role)
  values (p_dictionary_id, v_user_id, 'member')
  on conflict do nothing;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (v_user_id, p_dictionary_id, true, now())
  on conflict (user_id, dictionary_id) do update set opted_in = true, opted_in_at = now();
end;
$$;

-- 3. Members read everything in a shared notebook and write their own.
--    Changing and deleting stay owner-of-the-note only (the 0002 and 0041
--    policies).

create or replace function is_shared_notebook_member(p_dictionary_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from dictionaries d join dictionary_members m on m.dictionary_id = d.id
    where d.id = p_dictionary_id and d.address like 'notebook-%' and d.scope = 'group' and m.user_id = auth.uid()
  );
$$;

grant execute on function is_shared_notebook_member(uuid) to authenticated;

drop policy if exists "members read shared notebook notes" on notes;
create policy "members read shared notebook notes"
  on notes for select to authenticated
  using (is_shared_notebook_member(dictionary_id));

drop policy if exists "members write in shared notebooks" on notes;
create policy "members write in shared notebooks"
  on notes for insert to authenticated
  with check (owner_user_id = auth.uid() and is_shared_notebook_member(dictionary_id));

drop policy if exists "members read shared journal entries" on journal_entries;
create policy "members read shared journal entries"
  on journal_entries for select to authenticated
  using (is_shared_notebook_member(dictionary_id));

drop policy if exists "members write in shared journals" on journal_entries;
create policy "members write in shared journals"
  on journal_entries for insert to authenticated
  with check (owner_user_id = auth.uid() and is_shared_notebook_member(dictionary_id));

-- 4. Writers' names for a shared notebook: display name, else the part of
--    the email before the @.

create or replace function notebook_writers(p_dictionary_id uuid)
returns table (user_id uuid, name text)
language sql
stable
security definer set search_path = public
as $$
  select m.user_id, coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1))
  from dictionary_members m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.dictionary_id = p_dictionary_id and is_shared_notebook_member(p_dictionary_id);
$$;

revoke execute on function notebook_writers(uuid) from public, anon;
grant execute on function notebook_writers(uuid) to authenticated;
