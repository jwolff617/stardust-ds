-- Reserved labels: official, verified, government, and nonprofit are
-- earned. Only a moderator can put one on a dictionary. Everything else is
-- free: an owner labels their own dictionaries however they like.
--
-- Seeds run from the SQL editor (no signed-in user) are let through.

create or replace function guard_reserved_labels()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.label in ('official', 'verified', 'government', 'nonprofit')
     and auth.uid() is not null
     and not is_moderator() then
    raise exception '#% is earned. A moderator gives it.', new.label;
  end if;
  return new;
end;
$$;

drop trigger if exists dictionary_labels_reserved on dictionary_labels;
create trigger dictionary_labels_reserved
  before insert or update on dictionary_labels
  for each row execute function guard_reserved_labels();
