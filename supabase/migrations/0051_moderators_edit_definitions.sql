-- Moderators edit dictionary words from the page (2026-11-23). Saves a
-- definition's body. Note: the Stardust book is the source; a book sync
-- (sync_stardust_from_book.py) writes the book's text back over these, so
-- an edit made here should also go into the book.

create or replace function save_definition(p_id uuid, p_body text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Only moderators can change dictionary words.'; end if;
  if trim(coalesce(p_body, '')) = '' then raise exception 'A definition can''t be empty.'; end if;
  update definitions set body = left(p_body, 20000) where id = p_id;
end;
$$;
revoke execute on function save_definition(uuid, text) from public, anon;
grant execute on function save_definition(uuid, text) to authenticated;
