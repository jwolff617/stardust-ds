-- Personal dictionary instances.
--
-- v1 modeled a Night DS note as a personal_terms/personal_definitions row --
-- a word being "defined" under one shared night-ds dictionary every user
-- pointed at. That's wrong: a note isn't vocabulary, and each user should
-- get their own dictionary instance (own name, own address), not a shared
-- scope. night-ds becomes a template: its own shared vocabulary (Note,
-- Note Write, ...) stays put, but each opted-in user gets a personal
-- *instance* dictionary that points back at the template and holds their
-- actual notes in a new `notes` table.

-- Wipe the one test note along with the old personal-data shape entirely --
-- nothing else in v1 uses personal_terms/personal_definitions.
drop table if exists personal_definitions;
drop table if exists personal_terms;

alter table dictionaries
  drop constraint if exists dictionaries_kind_check,
  add constraint dictionaries_kind_check
    check (kind in ('core', 'stardust', 'topical', 'business', 'user_template', 'instance_template', 'instance'));

alter table dictionaries
  add column template_id uuid references dictionaries(id),
  add column display_kind text not null default 'term_table' check (display_kind in ('term_table', 'notes_list'));

-- One personal instance per user per template.
create unique index dictionaries_template_owner_idx
  on dictionaries(template_id, owner_user_id)
  where template_id is not null;

-- night-ds's own definitions (Note, Note Write, Note Edit, ...) are shared
-- vocabulary common to every Night DS user -- only actual notes are personal.
update dictionaries set scope = 'shared' where address = 'night-ds';

-- Opt-in state now lives on each user's instance, not the template.
delete from user_dictionaries
  where dictionary_id in (select id from dictionaries where kind = 'instance_template');

create table notes (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dictionary_id, title)
);

create index notes_dictionary_owner_idx on notes(dictionary_id, owner_user_id);

alter table notes enable row level security;

create policy "users manage their own notes"
  on notes for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Finds or creates the caller's personal instance of a template dictionary
-- (e.g. their own Night DS notes dictionary) and opts them into it.
-- Security definer, same pattern as handle_new_user() -- bypasses the
-- normal "submit a pending dictionary" RLS policy for this one privileged,
-- auto-approve-on-creation flow.
create function ensure_personal_instance(
  p_template_id uuid,
  p_owner_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_instance_id uuid;
  v_template dictionaries%rowtype;
begin
  if p_owner_id != auth.uid() then
    raise exception 'Cannot create a personal instance for another user.';
  end if;

  select * into v_template from dictionaries where id = p_template_id and kind = 'instance_template';
  if not found then
    raise exception 'Template dictionary not found.';
  end if;

  select id into v_instance_id
  from dictionaries
  where template_id = p_template_id and owner_user_id = p_owner_id;

  if v_instance_id is null then
    insert into dictionaries (
      address, name, description, kind, scope, status, locked,
      default_opt_in, owner_user_id, template_id, display_kind
    )
    values (
      v_template.address || '-' || substr(gen_random_uuid()::text, 1, 8),
      coalesce(nullif(trim(p_display_name), ''), 'My') || '''s Notes',
      v_template.description,
      'instance',
      'personal',
      'approved',
      false,
      false,
      p_owner_id,
      p_template_id,
      'notes_list'
    )
    returning id into v_instance_id;
  end if;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (p_owner_id, v_instance_id, true, now())
  on conflict (user_id, dictionary_id)
  do update set opted_in = true, opted_in_at = now();

  return v_instance_id;
end;
$$;

grant execute on function ensure_personal_instance(uuid, uuid, text) to authenticated;
