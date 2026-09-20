-- Night DS: the first custom dictionary, proving personal/instance
-- dictionaries work end to end. Authored fresh -- no prior seed to port.
-- The verbs below are shared vocabulary (every opted-in user gets the
-- identical Note Write/Edit/Search/Archive/Share definitions); the actual
-- notes a user writes are personal_terms/personal_definitions rows scoped
-- to this dictionary_id + their own owner_user_id, created at runtime by
-- Sage AI's note_write/note_edit/note_search/note_archive tools.

insert into terms (name) values
  ('Note'), ('Note Write'), ('Note Edit'), ('Note Search'),
  ('Note Archive'), ('Note Share');

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Note', 'A personal text entry stored privately under Night DS, visible only to its owner.', 'noun'),
  ('Note Write', 'Create a new personal Note.', 'verb'),
  ('Note Edit', 'Modify the content of an existing personal Note.', 'verb'),
  ('Note Search', 'Find personal Notes matching given criteria.', 'verb'),
  ('Note Archive', 'Move a personal Note out of active view without deleting it.', 'verb'),
  ('Note Share', 'Grant another user visibility into one of your personal Notes.', 'verb')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'night-ds';
