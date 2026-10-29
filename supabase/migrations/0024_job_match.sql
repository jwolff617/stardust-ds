-- Job Match DS: jobs, gigs, people looking for work, and training, on
-- Posts (0022). Every Job and Gig says what it pays (the app requires it).
-- Fair chance and No experience are fields with filters; Looking posts
-- match jobs, gigs, and trainings that share a label.
--
-- Needs 0022.

insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind
)
values (
  'job-match-ds', 'Job Match',
  'Jobs, gigs, free training, and people looking for work in Seattle. Every job says what it pays. Apply with a message from any phone.',
  'topical', 'shared', 'public', 'approved', false, false, 'jobs'
)
on conflict (address) do update set display_kind = excluded.display_kind, description = excluded.description;

insert into post_boards (dictionary_id, intro)
select id, 'Every job and gig here says what it pays, and most promise to answer everyone who writes. Apply with a short message. No ads, no sponsored jobs, and no fee to post.'
from dictionaries where address = 'job-match-ds'
on conflict (dictionary_id) do nothing;

insert into post_kinds (dictionary_id, name, description, position, expires_days)
select d.id, v.name, v.description, v.position, v.days
from dictionaries d
cross join (values
  ('Job', 'Steady paid work. Say what it pays, the hours, and how to apply.', 1, 30),
  ('Gig', 'Paid work for a day or a few. Say what it pays and when.', 2, 7),
  ('Looking', 'You want work. Say what kind and when you can work.', 3, 30),
  ('Training', 'A class or program that leads to work. Say what people leave with.', 4, 45)
) as v(name, description, position, days)
where d.address = 'job-match-ds'
on conflict (dictionary_id, name) do nothing;

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('jobs'), ('work'), ('gigs'), ('training'), ('fair-chance'), ('match'), ('seattle')) as v(label)
where address = 'job-match-ds'
on conflict do nothing;

insert into terms (name) values
  ('Job'), ('Gig'), ('Looking'), ('Training'), ('Pay'), ('Fair Chance'), ('Apply'), ('Filled')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Job', 'Steady paid work. Says what it pays, the hours, and how to apply.', 'more'),
  ('Gig', 'Paid work for a day or a few: moving, an event, a yard. Says what it pays.', 'more'),
  ('Looking', 'A spark looking for work: what kind, and when they can work.', 'more'),
  ('Training', 'A class or program that leads to work, with what you leave with.', 'more'),
  ('Pay', 'What the work pays, in dollars, said up front. Every job and gig on Job Match says it.', 'noun'),
  ('Fair Chance', 'A welcome to people with records. A fair chance employer looks at the person in front of them, not only their past.', 'noun'),
  ('Apply', 'Send a short message to whoever posted the work. When you can work and what you''ve done is enough.', 'verb'),
  ('Filled', 'The job has someone. Everyone who wrote hears so.', 'more')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'job-match-ds'
on conflict (term_id, dictionary_id) do nothing;
