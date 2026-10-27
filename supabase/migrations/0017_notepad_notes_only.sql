-- Notepad holds plain notes, with no titles. A title already typed moves to
-- the top of its note.

update notepad_pages
set body = case when trim(body) = '' then title else title || E'\n\n' || body end;

alter table notepad_pages drop column if exists title;

create index if not exists notepad_pages_created_idx on notepad_pages(dictionary_id, created_at desc);

delete from definitions
where dictionary_id = (select id from dictionaries where address = 'notepad-ds')
  and term_id = (select id from terms where name = 'Page');

insert into terms (name) values ('Note') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, 'One note on your notepad. It stays until you delete it.', 'noun'
from terms t, dictionaries d
where t.name = 'Note' and d.address = 'notepad-ds'
on conflict (term_id, dictionary_id) do nothing;

update dictionaries
set description = 'Notes that stay until you delete them, nine to a page. Private to you.'
where address = 'notepad-ds';
