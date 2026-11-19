-- Simplify, part 2 (2026-11-19).
--
-- 1. Journal: dated entries, newest first. Private.
-- 2. New notebook: make as many as you like, each one Notepad, Night
--    Notes, or Journal, with your own name. Private to you.
-- 3. Swap phones: in a private thread, each person can offer a phone or
--    email. Neither sees the other's until both have said yes.
-- 4. New names: Night Notes, Resources, Person Match, Idea Match,
--    Resource Match.
--
-- Needs 0040.

-- 1. Journal -----------------------------------------------------------------

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school',
                            'notepad', 'contacts', 'birthdays', 'journal',
                            'marketplace', 'jobs', 'ideas', 'manifesto', 'custom',
                            'listing', 'search'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school',
                                     'notepad', 'contacts', 'birthdays', 'journal',
                                     'marketplace', 'jobs', 'ideas', 'manifesto'));

insert into dictionaries (
  address, name, description, kind, scope, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values ('journal-ds', 'Journal', 'Dated entries about your day, newest first. Private to you.',
        'instance_template', 'personal', 'approved', false, false, 'Journal', 'journal')
on conflict (address) do nothing;

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_owner_idx on journal_entries(dictionary_id, created_at desc);
alter table journal_entries enable row level security;

drop policy if exists "users manage their own journal entries" on journal_entries;
create policy "users manage their own journal entries"
  on journal_entries for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and owns_dictionary_of_kind(dictionary_id, 'journal'));

-- 2. New notebook ------------------------------------------------------------

create or replace function create_notebook(p_style text, p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_kind text := case p_style when 'notepad' then 'notepad' when 'night' then 'notes_list' when 'journal' then 'journal' end;
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_kind is null then raise exception 'Pick Notepad, Night Notes, or Journal.'; end if;
  if v_name is null then raise exception 'Give your notebook a name.'; end if;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and address like 'notebook-%') >= 30 then
    raise exception 'You have 30 notebooks. Delete one to make another.';
  end if;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind)
  values ('notebook-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance', 'personal', 'private',
          'approved', false, false, auth.uid(), v_kind)
  returning id into v_id;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;

create or replace function rename_notebook(p_id uuid, p_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
begin
  if v_name is null then raise exception 'Give your notebook a name.'; end if;
  update dictionaries set name = v_name where id = p_id and owner_user_id = auth.uid() and address like 'notebook-%';
  if not found then raise exception 'That notebook isn''t yours.'; end if;
end;
$$;

-- Deletes the notebook and everything written in it.
create or replace function delete_notebook(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from dictionaries where id = p_id and owner_user_id = auth.uid() and address like 'notebook-%';
  if not found then raise exception 'That notebook isn''t yours.'; end if;
end;
$$;

revoke execute on function create_notebook(text, text), rename_notebook(uuid, text), delete_notebook(uuid) from public, anon;
grant execute on function create_notebook(text, text), rename_notebook(uuid, text), delete_notebook(uuid) to authenticated;

-- 3. Swap phones -------------------------------------------------------------
-- A thread is either a listing thread (dictionary + the person who asked)
-- or a post thread (post + the person who replied). Each side saves what
-- they're willing to share. Nobody reads this table directly: the
-- function below hands back the other side's only once both have said yes.

create table if not exists contact_swaps (
  thread text not null check (thread ~ '^[dp]:[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact text not null check (length(trim(contact)) between 3 and 120),
  created_at timestamptz not null default now(),
  primary key (thread, user_id)
);

alter table contact_swaps enable row level security;
-- No policies: only the functions below touch it.

-- Are you one of the two people in this thread? Returns the other person.
create or replace function thread_other(p_thread text)
returns uuid
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_kind text := split_part(p_thread, ':', 1);
  v_thing uuid := split_part(p_thread, ':', 2)::uuid;
  v_asker uuid := split_part(p_thread, ':', 3)::uuid;
  v_owner uuid;
begin
  if v_kind = 'd' then
    select owner_user_id into v_owner from dictionaries where id = v_thing;
  elsif v_kind = 'p' then
    select author_user_id into v_owner from posts where id = v_thing;
  end if;
  if v_owner is null or v_owner = v_asker then return null; end if;
  if auth.uid() = v_asker then return v_owner; end if;
  if auth.uid() = v_owner then return v_asker; end if;
  return null;
end;
$$;

-- Say yes: share your phone or email in this thread.
create or replace function offer_contact(p_thread text, p_contact text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if thread_other(p_thread) is null then raise exception 'That isn''t your conversation.'; end if;
  insert into contact_swaps (thread, user_id, contact) values (p_thread, auth.uid(), trim(p_contact))
  on conflict (thread, user_id) do update set contact = excluded.contact, created_at = now();
end;
$$;

-- Take it back. If they haven't seen it yet, they never will.
create or replace function withdraw_contact(p_thread text)
returns void
language sql
security definer set search_path = public
as $$
  delete from contact_swaps where thread = p_thread and user_id = auth.uid();
$$;

-- Where the swap stands: did I say yes, did they, and their contact once
-- both have.
create or replace function contact_swap(p_thread text)
returns table (mine text, they_said_yes boolean, theirs text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_other uuid := thread_other(p_thread);
  v_mine text;
  v_theirs text;
begin
  if v_other is null then return; end if;
  select contact into v_mine from contact_swaps where thread = p_thread and user_id = auth.uid();
  select contact into v_theirs from contact_swaps where thread = p_thread and user_id = v_other;
  return query select v_mine, v_theirs is not null, case when v_mine is not null then v_theirs end;
end;
$$;

revoke execute on function thread_other(text), offer_contact(text, text), withdraw_contact(text), contact_swap(text) from public, anon;
grant execute on function offer_contact(text, text), withdraw_contact(text), contact_swap(text) to authenticated;

-- 4. New names ---------------------------------------------------------------

update dictionaries set name = 'Night Notes', instance_name_suffix = 'Night Notes' where address = 'night-ds';
update dictionaries set name = 'Resources', instance_name_suffix = 'Resources',
  description = 'What you have and what you need. Private to you.'
  where address = 'accounts-ds';
update dictionaries set name = 'Person Match' where address = 'manifesto-match-ds';
update dictionaries set name = 'Idea Match' where address = 'idea-index-ds';
update dictionaries set name = 'Resource Match' where address = 'marketplace-ds';

-- Your own copies carry the old name after the apostrophe.
update dictionaries i set name = regexp_replace(i.name, '(Night DS|Notes)$', 'Night Notes')
from dictionaries t where i.template_id = t.id and t.address = 'night-ds' and i.name !~ 'Night Notes$';
update dictionaries i set name = regexp_replace(i.name, 'Accounts$', 'Resources')
from dictionaries t where i.template_id = t.id and t.address = 'accounts-ds';
