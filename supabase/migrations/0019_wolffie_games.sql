-- Wolffie Games DS: type a theme, how many kids, and their age, and get a
-- one-day printable packet: a 5-minute craft, a joke, a riddle, a game, a
-- paper cut-out, a coloring page, a word search, and a fact. Separate from
-- After School DS. Personal: your themes and packets are yours alone.

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                            'notepad', 'contacts', 'birthdays', 'wolffie_games'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                                     'notepad', 'contacts', 'birthdays', 'wolffie_games'));

insert into dictionaries (
  address, name, description, kind, scope, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values
  ('wolffie-games-ds', 'Wolffie Games',
   'Type a theme, how many kids, and their age. Get a one-day printable packet: craft, joke, riddle, game, cut-out, coloring page, word search.',
   'instance_template', 'personal', 'approved', false, false, 'Wolffie Games', 'wolffie_games')
on conflict (address) do nothing;

-- Themes you keep, to pick from before you generate.
create table if not exists wolffie_themes (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists wolffie_themes_name_idx on wolffie_themes(dictionary_id, lower(name));

-- Every packet you generate, kept so you can open or print it again for free.
create table if not exists wolffie_packets (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  themes text[] not null,
  kids smallint not null check (kids between 1 and 200),
  age smallint not null check (age between 3 and 14),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists wolffie_packets_created_idx on wolffie_packets(dictionary_id, created_at desc);

alter table wolffie_themes enable row level security;
alter table wolffie_packets enable row level security;

create policy "users manage their own wolffie themes"
  on wolffie_themes for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and owns_dictionary_of_kind(dictionary_id, 'wolffie_games'));

create policy "users manage their own wolffie packets"
  on wolffie_packets for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and owns_dictionary_of_kind(dictionary_id, 'wolffie_games'));

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('wolffie'), ('kids'), ('games'), ('printables'), ('teachers'), ('after school')) as v(label)
where address = 'wolffie-games-ds'
on conflict do nothing;

insert into terms (name) values ('Packet'), ('Theme') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Packet', 'One day of printable pages for a group of kids, made from a theme. Each item takes 5 minutes or less to prep.', 'noun'),
  ('Theme', 'What the day is about: space, pirates, fall. Pick more than one to mix them.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'wolffie-games-ds'
on conflict (term_id, dictionary_id) do nothing;
