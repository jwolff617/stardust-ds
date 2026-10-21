-- Night DS: time frames, labels, single-note archive, and Done.
--
-- Every note now has a time frame, which is its life: minute, hour, day,
-- week, month, year, decade, or life. When expires_at passes, the note
-- archives itself, so notes go away and you start fresh. A day note expires
-- at the user's local midnight; the app computes expires_at with the
-- user's timezone. Life notes never expire.
--
-- A note can carry one label: goal, lesson, memory, idea, person, place,
-- or any custom word.
--
-- A note's state:
--   active    archived_at is null and done_at is null
--   archived  archived_at is set (by hand, by "Archive all", or by expiry)
--   done      done_at is set; Done is its own archive
--
-- archive_id and note_archives stay as the grouping for "Archive all"
-- snapshots. archived_at is now the single source of truth for "archived".
-- Existing notes become life notes so nothing vanishes.

alter table notes
  add column if not exists time_frame text not null default 'life'
    check (time_frame in ('minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'life')),
  add column if not exists label text
    check (label is null or length(trim(label)) between 1 and 40),
  add column if not exists expires_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists done_at timestamptz;

update notes n
set archived_at = coalesce(a.created_at, now())
from note_archives a
where n.archive_id = a.id and n.archived_at is null;

create index if not exists notes_expiry_idx on notes(expires_at)
  where archived_at is null and done_at is null and expires_at is not null;

-- Archives every note whose time frame has run out. Idempotent and only
-- does what is already due, so the daily cron (anon key) and every note
-- read (signed-in user) can both call it.
create or replace function sweep_expired_notes()
returns integer
language sql
security definer set search_path = public
as $$
  with swept as (
    update notes
    set archived_at = expires_at, updated_at = now()
    where archived_at is null
      and done_at is null
      and expires_at is not null
      and expires_at <= now()
    returning 1
  )
  select count(*)::integer from swept;
$$;

grant execute on function sweep_expired_notes() to anon, authenticated;

-- Reorder only among active notes.
create or replace function move_note(p_note_id uuid, p_direction text)
returns void
language plpgsql
security definer set search_path = public
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
  from notes where id = p_note_id;

  if v_owner is null or v_owner != auth.uid() then
    raise exception 'Not found or not yours.';
  end if;

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from notes
    where dictionary_id = v_dictionary_id and owner_user_id = v_owner
      and archived_at is null and done_at is null and position < v_position
    order by position desc limit 1;
  elsif p_direction = 'down' then
    select id, position into v_neighbor_id, v_neighbor_position
    from notes
    where dictionary_id = v_dictionary_id and owner_user_id = v_owner
      and archived_at is null and done_at is null and position > v_position
    order by position asc limit 1;
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

-- "Archive all": sweeps the given active notes into one dated snapshot.
create or replace function archive_notes(p_dictionary_id uuid, p_note_ids uuid[], p_label text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_archive_id uuid;
begin
  insert into note_archives (dictionary_id, owner_user_id, label)
  values (p_dictionary_id, auth.uid(), p_label)
  returning id into v_archive_id;

  update notes
  set archive_id = v_archive_id, archived_at = now(), updated_at = now()
  where id = any(p_note_ids)
    and dictionary_id = p_dictionary_id
    and owner_user_id = auth.uid()
    and archived_at is null
    and done_at is null;

  return v_archive_id;
end;
$$;

-- Restoring a note (from Archived or Done) gives it a fresh time frame.
-- The caller computes p_expires_at for that time frame (null for life).
drop function if exists restore_note(uuid);
drop function if exists restore_archive(uuid);

create or replace function restore_note(p_note_id uuid, p_time_frame text, p_expires_at timestamptz)
returns void
language sql
security definer set search_path = public
as $$
  update notes
  set archive_id = null,
      archived_at = null,
      done_at = null,
      time_frame = p_time_frame,
      expires_at = p_expires_at,
      updated_at = now()
  where id = p_note_id and owner_user_id = auth.uid();
$$;

grant execute on function restore_note(uuid, text, timestamptz) to authenticated;

-- Night DS vocabulary and description for the new model.
insert into terms (name) values ('Done') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Done', 'A note you finished. Done notes live in their own archive, so you can look back at what you did in a minute, a year, or a life.', 'more')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'night-ds'
on conflict (term_id, dictionary_id) do nothing;

update definitions
set body = 'Set a Note aside before its time frame runs out. Notes also archive themselves when their time is up.'
where term_id = (select id from terms where name = 'Note Archive')
  and dictionary_id = (select id from dictionaries where address = 'night-ds');

update dictionaries
set description = 'Private notes that live for a time frame you choose, from a minute to a life. When the time is up, a note archives itself and you start fresh.'
where address = 'night-ds';

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('now'), ('time frame'), ('done')) as v(label)
where address = 'night-ds'
on conflict do nothing;
