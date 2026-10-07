-- Stardust becomes a locked, always-on dictionary like Core. It is the
-- language of love and human connection that Sage AI always speaks in --
-- the thing that sets Stardust DS apart from other AI.

update dictionaries
set locked = true,
    default_opt_in = true,
    description = 'The language of love and human connection: feeling, body, spirit, and soul. Always on.'
where address = 'stardust';

-- Anyone who had turned Stardust off gets it back on.
insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
select u.id, d.id, true, now()
from auth.users u
cross join dictionaries d
where d.address = 'stardust'
on conflict (user_id, dictionary_id) do update set opted_in = true;
