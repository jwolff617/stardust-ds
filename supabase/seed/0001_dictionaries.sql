-- The three dictionaries Milestone A ships: Core (locked, always on),
-- Stardust (locked, always on: the language of love and human connection
-- every Sage AI conversation speaks in), Night DS (personal notes, opt-in).

insert into dictionaries (address, name, description, kind, scope, status, locked, default_opt_in)
values
  ('core', 'Core', 'The universal action vocabulary every user shares. Always on.', 'core', 'shared', 'approved', true, true),
  ('stardust', 'Stardust', 'The language of love and human connection: feeling, body, spirit, and soul. Always on.', 'stardust', 'shared', 'approved', true, true),
  ('night-ds', 'Night DS', 'A private notes dictionary. Write, edit, search, and archive personal notes -- visible only to you.', 'instance_template', 'personal', 'approved', false, false);
