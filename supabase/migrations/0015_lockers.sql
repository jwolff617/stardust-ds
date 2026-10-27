-- Lockers and Lockers Admin: SHARE's locker program in North Seattle.
--
-- Lockers is shared: one public page everyone reads, with the program's
-- hours, rules, and announcements.
--
-- Lockers Admin is a group template with exactly one copy, SHARE's admin
-- group. Its members do the EC and Clerk work (participants, the lockers,
-- bars, attendance, reports) and are the only ones who can edit the
-- public Lockers page. A second copy is refused, so nobody can make their
-- own admin group and write to the public page.

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin'));

insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind
)
values (
  'lockers', 'Lockers',
  'SHARE Lockers in North Seattle: hours, rules, and announcements.',
  'topical', 'shared', 'public', 'approved', false, false, 'lockers'
)
on conflict (address) do nothing;

insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values (
  'lockers-admin-ds', 'Lockers Admin',
  'The EC and Clerk side of SHARE Lockers: participants, the lockers, bars, attendance, and reports. One admin group, members only.',
  'instance_template', 'group', 'members', 'approved', false, false,
  'Lockers Admin', 'lockers_admin'
)
on conflict (address) do nothing;

-- One admin group, ever.
create or replace function lockers_admin_single_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from dictionaries t where t.id = new.template_id and t.address = 'lockers-admin-ds')
     and exists (select 1 from dictionaries d where d.template_id = new.template_id) then
    raise exception 'SHARE Lockers already has its admin group. Ask its owner to add you.';
  end if;
  return new;
end;
$$;

drop trigger if exists lockers_admin_single_group on dictionaries;
create trigger lockers_admin_single_group
  before insert on dictionaries
  for each row when (new.template_id is not null)
  execute function lockers_admin_single_group();

create or replace function is_lockers_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from dictionary_members m
    join dictionaries d on d.id = m.dictionary_id
    join dictionaries t on t.id = d.template_id
    where t.address = 'lockers-admin-ds' and m.user_id = auth.uid()
  );
$$;

grant execute on function is_lockers_admin() to anon, authenticated;

-- The public page. Hours and rules are one block each; announcements are
-- a list, newest first.
create table if not exists lockers_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hours', 'rules', 'announcement')),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create unique index if not exists lockers_posts_page_idx
  on lockers_posts(kind) where kind in ('hours', 'rules');

alter table lockers_posts enable row level security;

create policy "anyone reads the lockers page"
  on lockers_posts for select
  to anon, authenticated
  using (true);

create policy "lockers admins edit the lockers page"
  on lockers_posts for all
  to authenticated
  using (is_lockers_admin())
  with check (is_lockers_admin());

-- The admin group's records. Everything belongs to the group copy and is
-- visible to every member.
create table if not exists lockers_participants (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  member_since date,
  renewed_thru date,
  shifts_required smallint not null default 1 check (shifts_required between 0 and 7),
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (dictionary_id, id)
);

-- A locker has a row once it's been assigned, marked broken, or noted.
create table if not exists lockers_lockers (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  number integer not null check (number between 1 and 1000),
  participant_id uuid,
  assigned_date date,
  broken boolean not null default false,
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (dictionary_id, number),
  foreign key (dictionary_id, participant_id)
    references lockers_participants(dictionary_id, id) on delete set null (participant_id)
);

-- A bar starts as a recommendation or is issued directly. A temporary bar
-- ends on end_date; a permanent one has none.
create table if not exists lockers_bars (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  participant_id uuid not null,
  status text not null check (status in ('recommended', 'issued', 'dismissed')),
  type text not null default 'temporary' check (type in ('temporary', 'permanent')),
  reason text not null default '',
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (dictionary_id, participant_id)
    references lockers_participants(dictionary_id, id) on delete cascade
);

-- One mark per participant, day, and kind: a work shift, Sunday meeting,
-- Power Lunch, or a mandatory makeup shift.
create table if not exists lockers_attendance (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  participant_id uuid not null,
  date date not null,
  kind text not null check (kind in ('work', 'sunday', 'power_lunch', 'mandatory')),
  status text not null check (status in ('scheduled', 'present', 'missed')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (participant_id, date, kind),
  foreign key (dictionary_id, participant_id)
    references lockers_participants(dictionary_id, id) on delete cascade
);

create index if not exists lockers_participants_group_idx on lockers_participants(dictionary_id, archived, name);
create index if not exists lockers_bars_group_idx on lockers_bars(dictionary_id, status);
create index if not exists lockers_attendance_group_idx on lockers_attendance(dictionary_id, date);

alter table lockers_participants enable row level security;
alter table lockers_lockers enable row level security;
alter table lockers_bars enable row level security;
alter table lockers_attendance enable row level security;

create policy "admin group members manage participants"
  on lockers_participants for all to authenticated
  using (is_dictionary_member(dictionary_id)) with check (is_dictionary_member(dictionary_id));

create policy "admin group members manage lockers"
  on lockers_lockers for all to authenticated
  using (is_dictionary_member(dictionary_id)) with check (is_dictionary_member(dictionary_id));

create policy "admin group members manage bars"
  on lockers_bars for all to authenticated
  using (is_dictionary_member(dictionary_id)) with check (is_dictionary_member(dictionary_id));

create policy "admin group members manage attendance"
  on lockers_attendance for all to authenticated
  using (is_dictionary_member(dictionary_id)) with check (is_dictionary_member(dictionary_id));

insert into dictionary_labels (dictionary_id, label)
select d.id, v.label
from dictionaries d
join (values
  ('lockers', 'lockers'), ('lockers', 'share'), ('lockers', 'seattle'), ('lockers', 'housing'),
  ('lockers-admin-ds', 'lockers'), ('lockers-admin-ds', 'share'), ('lockers-admin-ds', 'admin'), ('lockers-admin-ds', 'group')
) as v(address, label) on v.address = d.address
on conflict do nothing;

insert into terms (name)
values ('Locker'), ('Hours'), ('Rules'), ('Announcement'), ('Participant'), ('Bar'),
       ('Bar Recommendation'), ('Work Shift'), ('Sunday Meeting'), ('Power Lunch'), ('Makeup Shift'), ('Renewal')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('lockers', 'Locker', 'A place to keep your things safe while you live without a home.', 'noun'),
  ('lockers', 'Hours', 'When the lockers are open.', 'noun'),
  ('lockers', 'Rules', 'What everyone with a locker agrees to.', 'noun'),
  ('lockers', 'Announcement', 'News from the lockers staff.', 'noun'),
  ('lockers-admin-ds', 'Participant', 'Someone in the lockers program, with one or more lockers.', 'noun'),
  ('lockers-admin-ds', 'Locker', 'One of the numbered lockers. Free, assigned to a participant, or broken.', 'noun'),
  ('lockers-admin-ds', 'Bar', 'A break from the program, temporary with an end date or permanent.', 'noun'),
  ('lockers-admin-ds', 'Bar Recommendation', 'A bar someone has asked for. The EC issues it or dismisses it.', 'noun'),
  ('lockers-admin-ds', 'Work Shift', 'The shift a participant works to keep their locker.', 'noun'),
  ('lockers-admin-ds', 'Sunday Meeting', 'The weekly meeting participants attend.', 'noun'),
  ('lockers-admin-ds', 'Power Lunch', 'A lunch shift on the schedule.', 'noun'),
  ('lockers-admin-ds', 'Makeup Shift', 'A mandatory shift that makes up for a missed one.', 'noun'),
  ('lockers-admin-ds', 'Renewal', 'Keeping a locker for another term. Renewed Thru is the date it runs to.', 'noun')
) as v(address, name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = v.address
on conflict (term_id, dictionary_id) do nothing;
