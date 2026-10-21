-- Stardust words for Accounts DS. Accounts DS shows nine Stardust words as
-- accounts, in three groups:
--   Matrix:      Savings, Home, Avatar
--   Life:        Friends, Community, Hobbies
--   Imagination: Ideas, Reflections, Memories
-- The Matrix group uses the existing term "The Matrix".
--
-- These are short working definitions. The canonical definitions live in
-- books/stardust-dictionary/STARDUST_Dictionary_First_Edition.md (Avatar,
-- Community, Friends, Imagination, and Life are drawn from it). Sync these
-- to the book whenever it changes, and add the words the book is missing
-- (Savings, Home, Hobbies, Ideas, Reflections, Memories).
--
-- Same rows as migrations/0012_stardust_accounts_words.sql, for fresh
-- installs. Both are idempotent.

insert into terms (name) values
  ('Savings'), ('Home'), ('Avatar'),
  ('Friends'), ('Community'), ('Hobbies'),
  ('Ideas'), ('Reflections'), ('Memories'),
  ('Life'), ('Imagination')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, 'noun'
from (values
  ('Savings', 'What the avatar keeps for later. Money set aside, and anything else you put away so tomorrow has something to stand on.'),
  ('Home', 'The place the avatar returns to. Where the body rests and you care for the things that care for you.'),
  ('Avatar', 'The first part of identity: the body and its facts. Your height, your city, your dog, your job, what you built. The avatar''s work is saving money, exercising, and honoring home.'),
  ('Friends', 'The people who see you when the mask is off. The people you can tell the truth to, who tell you the truth back.'),
  ('Community', 'Trust reaching each other. Lifting each other up. Community is a practice.'),
  ('Hobbies', 'What you love doing with your days for the joy of it. Games, music, sport, making things: life at play.'),
  ('Ideas', 'Imagination given a shape you can hold, write down, and share.'),
  ('Reflections', 'Looking back at what happened and finding what it meant. The soul giving an experience its meaning after the fact.'),
  ('Memories', 'The moments the spark keeps. Every person who crossed your path left something, and you carry them.'),
  ('Life', 'The smallest unit of lifeforce, the electricity that is on. The second part of identity: what you love doing with your days and who you do it with.'),
  ('Imagination', 'The spark trying on a feeling that isn''t here yet. A dream you have while awake, so the body already half-knows a thing before it arrives.')
) as v(name, body)
join terms t on t.name = v.name
join dictionaries d on d.address = 'stardust'
on conflict (term_id, dictionary_id) do nothing;
