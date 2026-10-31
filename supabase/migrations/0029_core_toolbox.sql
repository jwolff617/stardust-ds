-- The Core Toolbox (dictionaries/Core_Toolbox.md): the nouns and verbs
-- every dictionary is written from, added to Core so anyone can read them
-- in Core's Term View and Sage AI can point people there. Words not built
-- yet say "Coming soon." Core already has Note, Person, Place, Price,
-- Phone Number, Email Address, Label, Time Frame, Post, Match, Message,
-- Call, Email, Share, Save, Renew, Report, and Block. Idempotent.

insert into terms (name) values
  ('Entry'), ('Group'), ('Event'), ('Text'), ('Long Text'), ('Number'), ('Money'),
  ('Date'), ('Time'), ('Timer'), ('Days'), ('Repeat'), ('Status'), ('Choice'),
  ('Check'), ('Rating'), ('Photo'), ('Link'),
  ('Done'), ('Order'), ('Start'), ('Stop'), ('Total'), ('Group By'), ('Assign'),
  ('Request'), ('Approve'), ('Remind'), ('Comment'), ('Join'), ('Generate')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  -- Nouns.
  ('Entry', 'One line in a record: a time, an amount, a visit.', 'noun'),
  ('Group', 'Sparks who share a dictionary.', 'noun'),
  ('Event', 'Something that happens at a time.', 'noun'),
  ('Text', 'A few words.', 'noun'),
  ('Long Text', 'Paragraphs.', 'noun'),
  ('Number', 'A number, or a word in its place.', 'noun'),
  ('Money', 'An amount, or free.', 'noun'),
  ('Date', 'A day.', 'noun'),
  ('Time', 'A time of day.', 'noun'),
  ('Timer', 'How long something took, with a running clock. Coming soon.', 'noun'),
  ('Days', 'Days until or since a date. Coming soon.', 'noun'),
  ('Repeat', 'Every day, week, month, or year. Coming soon.', 'noun'),
  ('Status', 'One choice from a short list, like Open or Taken.', 'noun'),
  ('Choice', 'One or more from a short list.', 'noun'),
  ('Check', 'Yes or no. Coming soon.', 'noun'),
  ('Rating', 'One to five. Coming soon.', 'noun'),
  ('Photo', 'Up to four pictures.', 'noun'),
  ('Link', 'A web address you can tap to open.', 'noun'),
  -- Verbs.
  ('Done', 'Check something off.', 'verb'),
  ('Order', 'Drag things into the order you want.', 'verb'),
  ('Start', 'Start a Timer. Coming soon.', 'verb'),
  ('Stop', 'Stop a Timer and keep the time. Coming soon.', 'verb'),
  ('Total', 'Add up Money, Numbers, or Timers, or count entries, by label or time.', 'verb'),
  ('Group By', 'Show a list in sections, by Status or Person. Coming soon.', 'verb'),
  ('Assign', 'Give something to a Person. Coming soon.', 'verb'),
  ('Request', 'Ask for something an admin has to approve. Coming soon.', 'verb'),
  ('Approve', 'Say yes to a Request. Coming soon.', 'verb'),
  ('Remind', 'Get an alert before a Date. Coming soon.', 'verb'),
  ('Comment', 'Answer a post in the open, where everyone can read it.', 'verb'),
  ('Join', 'Say you are in: you will help build it.', 'verb'),
  ('Generate', 'Let Sage AI fill something in for you.', 'verb')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core'
on conflict (term_id, dictionary_id) do nothing;
