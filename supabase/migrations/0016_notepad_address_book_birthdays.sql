-- The first basic apps in the store: Notepad, Address Book, and Birthdays.
-- Each is a personal template. Adding one makes your own private copy
-- ("Sage's Notepad"), and its records belong to you alone.
--
-- Notepad      pages that stay until you delete them. Night DS is for
--              letting go; Notepad is for keeping.
-- Address Book people: phone, email, address, notes.
-- Birthdays    name and day, with the year if you know it.

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                            'notepad', 'contacts', 'birthdays'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                                     'notepad', 'contacts', 'birthdays'));

insert into dictionaries (
  address, name, description, kind, scope, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values
  ('notepad-ds', 'Notepad',
   'Pages that stay until you delete them. Private to you.',
   'instance_template', 'personal', 'approved', false, false, 'Notepad', 'notepad'),
  ('address-book-ds', 'Address Book',
   'The people you know: phone, email, address, and notes. Private to you.',
   'instance_template', 'personal', 'approved', false, false, 'Address Book', 'contacts'),
  ('birthdays-ds', 'Birthdays',
   'Everyone''s birthday, with who''s next on top. Private to you.',
   'instance_template', 'personal', 'approved', false, false, 'Birthdays', 'birthdays')
on conflict (address) do nothing;

create table if not exists notepad_pages (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists birthdays (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  year smallint check (year between 1900 and 2100),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notepad_pages_owner_idx on notepad_pages(dictionary_id, updated_at desc);
create index if not exists contacts_owner_idx on contacts(dictionary_id, name);
create index if not exists birthdays_owner_idx on birthdays(dictionary_id, month, day);

alter table notepad_pages enable row level security;
alter table contacts enable row level security;
alter table birthdays enable row level security;

-- Your own records, in your own copy of the right dictionary.
create or replace function owns_dictionary_of_kind(p_dictionary_id uuid, p_display_kind text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from dictionaries
    where id = p_dictionary_id and owner_user_id = auth.uid() and display_kind = p_display_kind
  );
$$;

grant execute on function owns_dictionary_of_kind(uuid, text) to authenticated;

create policy "users manage their own notepad pages"
  on notepad_pages for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and owns_dictionary_of_kind(dictionary_id, 'notepad'));

create policy "users manage their own contacts"
  on contacts for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and owns_dictionary_of_kind(dictionary_id, 'contacts'));

create policy "users manage their own birthdays"
  on birthdays for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and owns_dictionary_of_kind(dictionary_id, 'birthdays'));

insert into dictionary_labels (dictionary_id, label)
select d.id, v.label
from dictionaries d
join (values
  ('notepad-ds', 'notepad'), ('notepad-ds', 'notes'), ('notepad-ds', 'writing'), ('notepad-ds', 'private'),
  ('address-book-ds', 'contacts'), ('address-book-ds', 'people'), ('address-book-ds', 'phone'), ('address-book-ds', 'private'),
  ('birthdays-ds', 'birthdays'), ('birthdays-ds', 'people'), ('birthdays-ds', 'calendar'), ('birthdays-ds', 'private')
) as v(address, label) on v.address = d.address
on conflict do nothing;

insert into terms (name) values ('Page'), ('Contact'), ('Birthday') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('notepad-ds', 'Page', 'One page in your notepad: a title and whatever you write under it.', 'noun'),
  ('address-book-ds', 'Contact', 'Someone you know, and how to reach them.', 'noun'),
  ('birthdays-ds', 'Birthday', 'The day someone was born. The year is optional.', 'noun')
) as v(address, name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = v.address
on conflict (term_id, dictionary_id) do nothing;
