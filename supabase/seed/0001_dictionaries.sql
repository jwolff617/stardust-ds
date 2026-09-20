-- The three dictionaries Milestone A ships: Core (locked, always on),
-- Stardust (on by default, removable), Night DS (personal notes, opt-in).

insert into dictionaries (address, name, description, kind, scope, status, locked, default_opt_in)
values
  ('core', 'Core', 'The universal action vocabulary every user shares. Always on.', 'core', 'shared', 'approved', true, true),
  ('stardust', 'Stardust', 'Feeling, body, spirit, and soul vocabulary. On by default, yours to turn off.', 'stardust', 'shared', 'approved', false, true),
  ('night-ds', 'Night DS', 'A private notes dictionary. Write, edit, search, and archive personal notes -- visible only to you.', 'instance_template', 'personal', 'approved', false, false);
