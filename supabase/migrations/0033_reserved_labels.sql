-- Labels, two rules. (Nothing to add for new labels or new dictionaries.)
--
-- 1. Imports (the shows column): any dictionary can list labels it imports. It shows every
--    dictionary carrying one of those labels, automatically. Idea Index
--    shows #idea; someone's Housing Market can show #housing. A copy of a
--    template shows what the template shows until its owner changes it.
-- 2. Earned labels: official, verified, government, and nonprofit. Only a
--    moderator can put one on a dictionary. Every other label is free.
--
-- Seeds run from the SQL editor (no signed-in user) are let through.

alter table dictionaries
  add column if not exists shows text[] not null default '{}' check (cardinality(shows) <= 10);

-- Sets the labels a dictionary shows. Its owner, or a moderator (for shared
-- dictionaries nobody owns).
create or replace function set_shows(p_id uuid, p_labels text[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_labels text[];
begin
  select coalesce(array_agg(distinct l), '{}') into v_labels
  from (
    select left(lower(trim(both from regexp_replace(x, '^#+', ''))), 40) as l
    from unnest(coalesce(p_labels, '{}')) as x
  ) s
  where l <> '';
  if cardinality(v_labels) > 10 then raise exception 'Up to 10 labels.'; end if;

  update dictionaries set shows = v_labels
  where id = p_id and (owner_user_id = auth.uid() or is_moderator());
  if not found then raise exception 'That dictionary isn''t yours.'; end if;
end;
$$;

revoke execute on function set_shows(uuid, text[]) from public, anon;
grant execute on function set_shows(uuid, text[]) to authenticated;

-- Sage (Peacemaker) made the boards, so Sage owns them: their labels and
-- imports are Sage's to change.
update dictionaries
set owner_user_id = (select id from auth.users where email = 'jwolff617@gmail.com')
where address in ('marketplace-ds', 'job-match-ds', 'idea-index-ds', 'manifesto-match-ds', 'idea-house-ds')
  and owner_user_id is null;

-- The boards show their own labels.
update dictionaries set shows = '{idea}' where address = 'idea-index-ds';
update dictionaries set shows = '{marketplace}' where address = 'marketplace-ds';
update dictionaries set shows = '{jobs}' where address = 'job-match-ds';

create or replace function guard_reserved_labels()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.label in ('official', 'verified', 'government', 'nonprofit')
     and auth.uid() is not null
     and not is_moderator() then
    raise exception '"%" is earned. A moderator gives it.', new.label;
  end if;
  return new;
end;
$$;

drop trigger if exists dictionary_labels_reserved on dictionary_labels;
create trigger dictionary_labels_reserved
  before insert or update on dictionary_labels
  for each row execute function guard_reserved_labels();
