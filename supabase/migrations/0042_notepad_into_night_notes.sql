-- Two ways to write (2026-11-19): Night Notes and Journal.
--
-- Notepad folds into Night Notes. A Life note never expires, and card
-- view looks like Notepad, so nothing is lost. Each Notepad becomes a
-- Night Notes notebook with the same name, and each of its notes becomes
-- a Life note with the same words and dates.
--
-- Needs 0041.

-- 1. Every Notepad (the store copy and any you made) becomes a Night Notes
--    notebook. Store copies stop being copies of the Notepad template so
--    the one-copy-per-template rule doesn't clash with your own Night Notes.

update dictionaries d
set display_kind = 'notes_list',
    template_id = null,
    address = 'notebook-' || substr(gen_random_uuid()::text, 1, 12),
    name = regexp_replace(d.name, '^.{1,40}?[''’]s\s+', ''),
    description = null
where d.display_kind = 'notepad';

-- 2. Their notes become Life notes, oldest first, keeping their dates.

insert into notes (dictionary_id, owner_user_id, body, position, visibility, time_frame, created_at, updated_at)
select p.dictionary_id, p.owner_user_id, p.body,
       row_number() over (partition by p.dictionary_id order by p.created_at),
       'private', 'life', p.created_at, p.updated_at
from notepad_pages p
where length(trim(p.body)) > 0;

-- 3. The Notepad template and its table.

delete from dictionaries where address = 'notepad-ds';
drop table if exists notepad_pages cascade;

-- 4. New notebook offers Night Notes or Journal.

create or replace function create_notebook(p_style text, p_name text)
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
  values ('notebook-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance', 'personal', 'private',
          'approved', false, false, auth.uid(), v_kind)
  returning id into v_id;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;

-- 5. Kinds left.

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school',
                            'contacts', 'birthdays', 'journal',
                            'marketplace', 'jobs', 'ideas', 'manifesto', 'custom',
                            'listing', 'search'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school',
                                     'contacts', 'birthdays', 'journal',
                                     'marketplace', 'jobs', 'ideas', 'manifesto'));

update dictionaries set description = 'Longer entries about your days, kept to look back on in a year or a decade. Private to you.'
where address = 'journal-ds';
