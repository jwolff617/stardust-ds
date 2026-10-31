-- Bet cards (2026-10-31): every bet gets a card first. Ten minutes of
-- research, then what you read, what you think, and what your body feels.
-- A card is a Bet Story with the outcome 'card'.

alter table bet_stories
  drop constraint if exists bet_stories_outcome_check,
  add constraint bet_stories_outcome_check check (outcome in ('card', 'win', 'loss', 'missed', 'other'));

insert into terms (name) values ('Bet Card') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id,
  'The rule before every bet: take ten minutes, read an article or a blog, think, and feel what your body feels. Write the bet, what you read, what you think, and what you feel. No card, no bet.',
  'noun'
from terms t
join dictionaries d on d.address = 'worthy-ds'
where t.name = 'Bet Card'
on conflict (term_id, dictionary_id) do nothing;
