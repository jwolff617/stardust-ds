-- Night DS drag to reorder: put a note where another note is, and shift
-- the notes in between by one. Only your own active notes in the same
-- dictionary move.

create or replace function move_note_to(p_note_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_dictionary_id uuid;
  v_owner uuid;
  v_from integer;
  v_to integer;
begin
  select dictionary_id, owner_user_id, position into v_dictionary_id, v_owner, v_from
  from notes where id = p_note_id and archived_at is null and done_at is null;

  if v_owner is null or v_owner != auth.uid() then
    raise exception 'Not found or not yours.';
  end if;

  select position into v_to
  from notes
  where id = p_target_id and dictionary_id = v_dictionary_id and owner_user_id = v_owner
    and archived_at is null and done_at is null;

  if v_to is null or v_to = v_from then
    return;
  end if;

  if v_to < v_from then
    update notes set position = position + 1, updated_at = now()
    where dictionary_id = v_dictionary_id and owner_user_id = v_owner
      and archived_at is null and done_at is null
      and position >= v_to and position < v_from;
  else
    update notes set position = position - 1, updated_at = now()
    where dictionary_id = v_dictionary_id and owner_user_id = v_owner
      and archived_at is null and done_at is null
      and position > v_from and position <= v_to;
  end if;

  update notes set position = v_to, updated_at = now() where id = p_note_id;
end;
$$;

grant execute on function move_note_to(uuid, uuid) to authenticated;
