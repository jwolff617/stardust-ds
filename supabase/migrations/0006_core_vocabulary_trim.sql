-- Core vocabulary trim. Core grew to ~63 terms, most of them compound
-- "Dictionary X" / "User Dictionary X" verbs. The goal now is a list every
-- user can read end to end and know: 19 verbs, 21 nouns, and 2 words
-- (Label, View) that are both.
--
-- Clears Core's old definitions, drops any term left with no definition in
-- any dictionary, then writes the new vocabulary. Terms are shared across
-- dictionaries, so a term still defined by Stardust, Night DS, or anything
-- else is kept. seed/0002_core.sql holds the same list for fresh installs;
-- both are idempotent.

delete from definitions
where dictionary_id = (select id from dictionaries where address = 'core');

delete from terms t
where not exists (select 1 from definitions d where d.term_id = t.id);

insert into terms (name) values
  ('Add'), ('Remove'), ('Edit'), ('Delete'), ('Archive'), ('Restore'),
  ('Find'), ('Filter'), ('Share'), ('Connect'), ('Match'), ('Message'),
  ('Email'), ('Call'), ('Vote'), ('Buy'), ('Sell'), ('Trade'), ('Give'),
  ('Label'), ('View'),
  ('Spark'), ('Person'), ('Business'), ('Nonprofit'), ('Government'),
  ('Dictionary'), ('Term'), ('Definition'), ('Private Profile'),
  ('Public Profile'), ('Place'), ('City'), ('Neighborhood'),
  ('Email Address'), ('Phone Number'), ('Hours'), ('Price'), ('Note'),
  ('Account'), ('Time Frame'), ('Connection')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  -- Verbs.
  ('Add', 'Put something new into a dictionary or your collection.', 'verb'),
  ('Remove', 'Take a dictionary out of your collection. You can add it back anytime.', 'verb'),
  ('Edit', 'Change something that already exists.', 'verb'),
  ('Delete', 'Erase something for good.', 'verb'),
  ('Archive', 'Set something aside, out of view, without erasing it.', 'verb'),
  ('Restore', 'Bring something back from the archive.', 'verb'),
  ('Find', 'Look for a dictionary, term, note, or spark by its words or labels.', 'verb'),
  ('Filter', 'Narrow what you see to the dictionaries, labels, or words you choose.', 'verb'),
  ('Share', 'Choose who can see something: just you, or everyone.', 'verb'),
  ('Connect', 'Link two sparks so they can reach each other.', 'verb'),
  ('Match', 'Pair two sparks whose dictionaries fit together.', 'verb'),
  ('Message', 'Send words to a connected spark inside Stardust DS.', 'verb'),
  ('Email', 'Send a message to an Email Address.', 'verb'),
  ('Call', 'Start a voice call to a Phone Number.', 'verb'),
  ('Vote', 'Say yes or no on something, counted with everyone else''s.', 'verb'),
  ('Buy', 'Get something by paying its Price.', 'verb'),
  ('Sell', 'Offer something for a Price.', 'verb'),
  ('Trade', 'Exchange one thing for another without money.', 'verb'),
  ('Give', 'Hand something to another spark for free.', 'verb'),

  -- Both a verb and a noun.
  ('Label', 'A short word on a dictionary that helps people find it; to put one there.', 'more'),
  ('View', 'A way of looking at a dictionary, as its terms or as its display; to look at one.', 'more'),

  -- Nouns.
  ('Spark', 'Anyone who acts in Stardust DS: a person, a business, a nonprofit, or a government.', 'noun'),
  ('Person', 'A spark who is one human being.', 'noun'),
  ('Business', 'A spark that sells goods or services.', 'noun'),
  ('Nonprofit', 'A spark that serves a mission instead of profit.', 'noun'),
  ('Government', 'A spark that serves the public, like a city office or agency.', 'noun'),
  ('Dictionary', 'A named set of terms and their definitions.', 'noun'),
  ('Term', 'A word or phrase that a dictionary defines.', 'noun'),
  ('Definition', 'What a term means in one dictionary.', 'noun'),
  ('Private Profile', 'Your registration and payment info, seen only by you.', 'noun'),
  ('Public Profile', 'Your contact info, location, and who you are, shared with the fields you choose.', 'noun'),
  ('Place', 'A spot in the world where something happens.', 'noun'),
  ('City', 'The town a spark lives or works in. Stardust DS starts in Seattle.', 'noun'),
  ('Neighborhood', 'The part of a city a spark calls home.', 'noun'),
  ('Email Address', 'Where an Email goes, written as name@domain.', 'noun'),
  ('Phone Number', 'The digits you Call to reach a spark.', 'noun'),
  ('Hours', 'The times a place or spark is open.', 'noun'),
  ('Price', 'What something costs.', 'noun'),
  ('Note', 'A short piece of writing you keep.', 'noun'),
  ('Account', 'A running record of what you save, spend, or track.', 'noun'),
  ('Time Frame', 'How long something lasts, from a day to a life.', 'noun'),
  ('Connection', 'A link between two sparks.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'core'
on conflict (term_id, dictionary_id) do nothing;

update dictionaries
set description = 'The words every spark shares: simple actions and everyday things. Always on.'
where address = 'core';
