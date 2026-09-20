-- Night DS: note reordering, archive snapshots, and public/private notes.
--
-- Replaces the single archived boolean with a snapshot model (archive_id
-- pointing at a dated note_archives row, null = active), adds a
-- user-controlled position for reordering, and adds visibility so public
-- notes can be read by future dictionaries sharing this same database
-- (Idea Index, Manifesto Match, housing/job matching).

create table note_archives (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

create index note_archives_dictionary_owner_idx on note_archives(dictionary_id, owner_user_id);

alter table note_archives enable row level security;

create policy "users manage their own archives"
  on note_archives for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

alter table notes
  add column position integer,
  add column visibility text not null default 'private' check (visibility in ('private', 'public')),
  add column archive_id uuid references note_archives(id) on delete set null;

-- Backfill position from creation order (1-based, per dictionary).
with ranked as (
  select id, row_number() over (partition by dictionary_id order by created_at) as rn
  from notes
)
update notes set position = ranked.rn
from ranked
where notes.id = ranked.id;

alter table notes alter column position set not null;

-- Preserve any existing archived=true rows as one dated legacy snapshot per
-- dictionary/owner, rather than silently losing the boolean's meaning.
insert into note_archives (dictionary_id, owner_user_id, label)
select distinct dictionary_id, owner_user_id, 'Archived before reorder feature'
from notes
where archived = true;

update notes
set archive_id = (
  select a.id from note_archives a
  where a.dictionary_id = notes.dictionary_id
    and a.owner_user_id = notes.owner_user_id
    and a.label = 'Archived before reorder feature'
)
where archived = true;

alter table notes drop column archived;

-- The old unconditional unique(dictionary_id, title) meant an archived note
-- permanently blocked reusing its title -- breaks "archive all and start
-- fresh" as a real workflow. Scope uniqueness to active notes only.
alter table notes drop constraint notes_dictionary_id_title_key;
create unique index notes_active_title_idx on notes(dictionary_id, title) where archive_id is null;

-- New notes (API route, Sage AI note_write) don't compute a position
-- themselves -- they append to the end of the dictionary's active list.
create function notes_set_default_position() returns trigger
language plpgsql as $$
begin
  if new.position is null then
    select coalesce(max(position), 0) + 1 into new.position
    from notes where dictionary_id = new.dictionary_id;
  end if;
  return new;
end;
$$;

create trigger notes_default_position
  before insert on notes
  for each row execute function notes_set_default_position();

-- Public notes become readable by any signed-in user (additive to, not a
-- replacement for, the existing owner-only "for all" policy below -- RLS
-- combines permissive policies with OR). This is the entire mechanism by
-- which future dictionaries in this same database read shared notes.
create policy "public notes are readable by any authenticated user"
  on notes for select
  to authenticated
  using (visibility = 'public');

-- Adjacent-swap reorder: deliberately the simplest mechanism that works
-- correctly regardless of what page of a paginated note list the caller
-- currently has loaded (fractional indexing and full-list reindexing were
-- both considered and rejected as unnecessary complexity for this scale).
-- The server looks up the true neighbor by position itself, so the client
-- never needs to know its id. No-ops at either edge of the list.
create function move_note(p_note_id uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dictionary_id uuid;
  v_owner uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
begin
  select dictionary_id, owner_user_id, position
    into v_dictionary_id, v_owner, v_position
  from notes
  where id = p_note_id;

  if v_owner is null or v_owner != auth.uid() then
    raise exception 'Not found or not yours.';
  end if;

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from notes
    where dictionary_id = v_dictionary_id
      and owner_user_id = v_owner
      and archive_id is null
      and position < v_position
    order by position desc
    limit 1;
  elsif p_direction = 'down' then
    select id, position into v_neighbor_id, v_neighbor_position
    from notes
    where dictionary_id = v_dictionary_id
      and owner_user_id = v_owner
      and archive_id is null
      and position > v_position
    order by position asc
    limit 1;
  else
    raise exception 'Invalid direction.';
  end if;

  if v_neighbor_id is null then
    return;
  end if;

  update notes set position = v_neighbor_position, updated_at = now() where id = p_note_id;
  update notes set position = v_position, updated_at = now() where id = v_neighbor_id;
end;
$$;

grant execute on function move_note(uuid, text) to authenticated;

-- Bulk archive: sweeps the given active notes into one new dated snapshot.
-- The caller computes p_note_ids as "currently active notes minus whatever
-- was deselected", which gives selective-exclusion archiving for free.
create function archive_notes(p_dictionary_id uuid, p_note_ids uuid[], p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archive_id uuid;
begin
  insert into note_archives (dictionary_id, owner_user_id, label)
  values (p_dictionary_id, auth.uid(), p_label)
  returning id into v_archive_id;

  update notes
  set archive_id = v_archive_id
  where id = any(p_note_ids)
    and dictionary_id = p_dictionary_id
    and owner_user_id = auth.uid()
    and archive_id is null;

  return v_archive_id;
end;
$$;

grant execute on function archive_notes(uuid, uuid[], text) to authenticated;

create function restore_note(p_note_id uuid) returns void
language sql
security definer
set search_path = public
as $$
  update notes set archive_id = null, updated_at = now()
  where id = p_note_id and owner_user_id = auth.uid();
$$;

grant execute on function restore_note(uuid) to authenticated;

create function restore_archive(p_archive_id uuid) returns void
language sql
security definer
set search_path = public
as $$
  update notes set archive_id = null, updated_at = now()
  where archive_id = p_archive_id and owner_user_id = auth.uid();
$$;

grant execute on function restore_archive(uuid) to authenticated;
