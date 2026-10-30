-- Dictionaries a person builds by talking to Sage AI. Each one is a
-- personal dictionary with its own fields (up to 8: text, long text,
-- number, or date) and one shared Display View ('custom'), so anything
-- Sage builds looks and works like the rest of Stardust. Personal ones are
-- approved at once; only the owner can see them or their entries.

alter table dictionaries
  add column if not exists fields jsonb check (fields is null or jsonb_typeof(fields) = 'array');

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                            'notepad', 'contacts', 'birthdays', 'wolffie_games',
                            'marketplace', 'jobs', 'ideas', 'manifesto', 'idea_house', 'custom'));

create table if not exists custom_entries (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- { field key: value }, checked by the app against the dictionary's fields.
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and length(data::text) <= 20000),
  labels text[] not null default '{}' check (cardinality(labels) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_entries_dictionary_idx on custom_entries(dictionary_id, created_at desc);

alter table custom_entries enable row level security;

drop policy if exists "owners manage their custom entries" on custom_entries;
create policy "owners manage their custom entries"
  on custom_entries for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from dictionaries d
      where d.id = dictionary_id and d.owner_user_id = auth.uid() and d.display_kind = 'custom'
    )
  );

-- Makes a personal dictionary for the caller and turns it on. The app
-- checks the fields first; this checks them again, so a bad call can't
-- make a broken dictionary.
create or replace function create_custom_dictionary(p_name text, p_description text, p_fields jsonb)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text := left(nullif(trim(p_name), ''), 60);
  v_field jsonb;
begin
  if auth.uid() is null then
    raise exception 'Log in first.';
  end if;
  if v_name is null then
    raise exception 'Give the dictionary a name.';
  end if;
  if jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) not between 1 and 8 then
    raise exception 'A dictionary needs 1 to 8 fields.';
  end if;
  for v_field in select * from jsonb_array_elements(p_fields) loop
    if coalesce(v_field ->> 'key', '') !~ '^[a-z][a-z0-9_]{0,29}$'
       or coalesce(length(v_field ->> 'label'), 0) not between 1 and 40
       or coalesce(v_field ->> 'type', '') not in ('text', 'longtext', 'number', 'date') then
      raise exception 'Each field needs a short name and a type: text, longtext, number, or date.';
    end if;
  end loop;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'custom') >= 25 then
    raise exception 'You have 25 dictionaries you built. Delete one to make another.';
  end if;

  insert into dictionaries (address, name, description, kind, scope, status, locked, default_opt_in, owner_user_id, display_kind, fields)
  values (
    'custom-' || substr(gen_random_uuid()::text, 1, 12),
    v_name,
    left(nullif(trim(p_description), ''), 300),
    'instance',
    'personal',
    'approved',
    false,
    false,
    auth.uid(),
    'custom',
    p_fields
  )
  returning id into v_id;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (auth.uid(), v_id, true, now());

  return v_id;
end;
$$;

revoke execute on function create_custom_dictionary(text, text, jsonb) from public, anon;
grant execute on function create_custom_dictionary(text, text, jsonb) to authenticated;

-- Deletes one of the caller's own built dictionaries and its entries.
create or replace function delete_custom_dictionary(p_dictionary_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from dictionaries
  where id = p_dictionary_id and owner_user_id = auth.uid() and display_kind = 'custom';
  if not found then
    raise exception 'That dictionary isn''t one you built.';
  end if;
end;
$$;

revoke execute on function delete_custom_dictionary(uuid) from public, anon;
grant execute on function delete_custom_dictionary(uuid) to authenticated;
