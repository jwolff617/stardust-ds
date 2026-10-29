-- Manifesto Match DS on Posts (0022): write who you are in your own words
-- (words from a list, each with your own line), and match with people who
-- share them. One manifesto per kind per spark. The whole board is 18+.
-- Each kind is mutual: you see others' manifestos only while yours is up.
-- Dating is built and closed; Sage opens it when stewards are ready (see
-- dictionaries/Manifesto_Match_DS.md).
--
-- Needs 0022.

insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind
)
values (
  'manifesto-match-ds', 'Manifesto Match',
  'Write who you are in your own words, and find friends and business partners who share them. Words first, no photos. 18 and older.',
  'topical', 'shared', 'public', 'approved', false, false, 'manifesto'
)
on conflict (address) do update set display_kind = excluded.display_kind, description = excluded.description;

insert into post_boards (dictionary_id, intro)
select id, 'Pick the words that matter most to you and say what each one means to you. You''ll see people who share your words, most shared first. You see others once yours is up, and they see you.'
from dictionaries where address = 'manifesto-match-ds'
on conflict (dictionary_id) do nothing;

insert into post_kinds (dictionary_id, name, description, position, expires_days, adult_only, one_per_person, mutual, open)
select d.id, v.name, v.description, v.position, null, true, true, true, v.open
from dictionaries d
cross join (values
  ('Friends', 'Find friends who share your words.', 1, true),
  ('Business Partners', 'Find someone to build with, by shared words before skills.', 2, true),
  ('Dating', 'Find someone to date. Opens soon.', 3, false)
) as v(name, description, position, open)
where d.address = 'manifesto-match-ds'
on conflict (dictionary_id, name) do nothing;

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('match'), ('friends'), ('business'), ('partners'), ('manifesto'), ('seattle')) as v(label)
where address = 'manifesto-match-ds'
on conflict do nothing;

insert into terms (name) values
  ('Manifesto'), ('Line'), ('Match'), ('Say Hello'), ('Pause'), ('Business Partner')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Manifesto', 'Who you are, in your own words: a headline, a few lines, and the words that matter most to you, each with what it means to you.', 'noun'),
  ('Line', 'One word from your manifesto and what it means to you, in a sentence or two.', 'noun'),
  ('Match', 'Find the sparks who share your words. The more words you share, the higher they show.', 'verb'),
  ('Say Hello', 'Send the first private message to a match, starting from a word you share.', 'verb'),
  ('Pause', 'Take your manifesto down for now. You won''t show up, and you won''t see others, until you unpause.', 'verb'),
  ('Business Partner', 'Someone to build a thing with, found by shared words before skills.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'manifesto-match-ds'
on conflict (term_id, dictionary_id) do nothing;
