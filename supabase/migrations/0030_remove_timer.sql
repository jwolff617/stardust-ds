-- Sage dropped the timer (2026-10-31): Timer, Start, and Stop come out of
-- Core, and Total no longer mentions timers.

delete from definitions
where dictionary_id = (select id from dictionaries where address = 'core')
  and term_id in (select id from terms where name in ('Timer', 'Start', 'Stop'));

update definitions
set body = 'Add up Money or Numbers, or count entries, by label or time.'
where dictionary_id = (select id from dictionaries where address = 'core')
  and term_id = (select id from terms where name = 'Total');
