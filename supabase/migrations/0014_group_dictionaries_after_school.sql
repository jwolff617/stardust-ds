-- Three classes of dictionary, and After School DS, the first group one.
--
-- Every dictionary has exactly one class (the `scope` column):
--   shared    one copy everyone reads, like a public reference book.
--             Core, Stardust.
--   personal  a template each person gets their own private copy of.
--             Night DS, Accounts DS, Worthy DS, the profiles.
--   group     a template anyone can copy into a group. A group's copy has
--             members, and everything in it is visible to every member,
--             like a Facebook page or a Slack channel. After School DS.
-- A template carries the class of the copies made from it.
--
-- Each dictionary also has a visibility, defaulting from its class:
--   shared -> public, personal -> private, group -> members.
-- A template's visibility is its copies' visibility, and a new copy
-- inherits it. A dictionary can differ from its class default: the Public
-- Profile is personal but public.

-- Night DS was marked shared back when its vocabulary was the point. Its
-- copies are personal, so the template is personal.
update dictionaries set scope = 'personal' where address = 'night-ds';

alter table dictionaries
  drop constraint if exists dictionaries_scope_check,
  add constraint dictionaries_scope_check check (scope in ('shared', 'personal', 'group'));

alter table dictionaries
  add column if not exists visibility text check (visibility in ('public', 'private', 'members'));

update dictionaries
set visibility = case scope when 'shared' then 'public' when 'group' then 'members' else 'private' end
where visibility is null;

update dictionaries d
set visibility = 'public'
from dictionaries t
where t.id = d.template_id and t.address = 'public-profile';
update dictionaries set visibility = 'public' where address = 'public-profile';

-- New rows without a visibility inherit their template's, else get their
-- class default.
create or replace function dictionaries_default_visibility()
returns trigger
language plpgsql
as $$
begin
  if new.visibility is null and new.template_id is not null then
    select visibility into new.visibility from dictionaries where id = new.template_id;
  end if;
  if new.visibility is null then
    new.visibility := case new.scope when 'shared' then 'public' when 'group' then 'members' else 'private' end;
  end if;
  return new;
end;
$$;

drop trigger if exists dictionaries_default_visibility on dictionaries;
create trigger dictionaries_default_visibility
  before insert on dictionaries
  for each row execute function dictionaries_default_visibility();

alter table dictionaries alter column visibility set not null;

-- A person has one copy of a personal template. A group template can be
-- copied into any number of groups.
drop index if exists dictionaries_template_owner_idx;
create unique index dictionaries_template_owner_idx
  on dictionaries(template_id, owner_user_id)
  where template_id is not null and scope = 'personal';

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school'));

-- Group members. The owner is a member too, with the owner role.
create table if not exists dictionary_members (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (dictionary_id, user_id)
);

create index if not exists dictionary_members_user_idx on dictionary_members(user_id);

alter table dictionary_members enable row level security;

-- Security definer so policies on other tables can ask "is the caller a
-- member?" without running into this table's own policy.
create or replace function is_dictionary_member(p_dictionary_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from dictionary_members
    where dictionary_id = p_dictionary_id and user_id = auth.uid()
  );
$$;

grant execute on function is_dictionary_member(uuid) to authenticated;

create policy "members see who else is in their groups"
  on dictionary_members for select
  to authenticated
  using (is_dictionary_member(dictionary_id));

-- Members can read their group's dictionary row.
drop policy if exists "dictionaries are readable when approved and discoverable" on dictionaries;

create policy "dictionaries are readable when approved and discoverable"
  on dictionaries for select
  using (
    status = 'approved'
    and (
      kind != 'instance'
      or owner_user_id = auth.uid()
      or (auth.uid() is not null and template_id = public_profile_template_id())
      or (scope = 'group' and is_dictionary_member(id))
    )
  );

-- A personal template never makes a group, and the reverse.
create or replace function create_personal_instance(
  p_template_id uuid,
  p_owner_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_instance_id uuid;
  v_template dictionaries%rowtype;
begin
  select * into v_template from dictionaries
  where id = p_template_id and kind = 'instance_template' and scope = 'personal';
  if not found then
    raise exception 'Template dictionary not found.';
  end if;

  select id into v_instance_id
  from dictionaries
  where template_id = p_template_id and owner_user_id = p_owner_id;

  if v_instance_id is null then
    insert into dictionaries (
      address, name, description, kind, scope, status, locked,
      default_opt_in, owner_user_id, template_id, display_kind
    )
    values (
      v_template.address || '-' || substr(gen_random_uuid()::text, 1, 8),
      case
        when nullif(trim(p_display_name), '') is null then 'My '
        else trim(p_display_name) || '''s '
      end || coalesce(v_template.instance_name_suffix, v_template.name),
      v_template.description,
      'instance',
      'personal',
      'approved',
      v_template.locked,
      false,
      p_owner_id,
      p_template_id,
      coalesce(v_template.instance_display_kind, 'notes_list')
    )
    returning id into v_instance_id;
  end if;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (p_owner_id, v_instance_id, true, now())
  on conflict (user_id, dictionary_id)
  do update set opted_in = true, opted_in_at = now();

  return v_instance_id;
end;
$$;

revoke execute on function create_personal_instance(uuid, uuid, text) from public, anon, authenticated;

-- Makes a new group from a group template. The caller owns it, is its
-- first member, and has it turned on.
create or replace function create_group(p_template_id uuid, p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_template dictionaries%rowtype;
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if auth.uid() is null then
    raise exception 'Log in to make a group.';
  end if;
  if v_name is null or length(v_name) > 80 then
    raise exception 'A group needs a name, up to 80 characters.';
  end if;

  select * into v_template from dictionaries
  where id = p_template_id and kind = 'instance_template' and scope = 'group';
  if not found then
    raise exception 'Group template not found.';
  end if;

  insert into dictionaries (
    address, name, description, kind, scope, visibility, status, locked,
    default_opt_in, owner_user_id, template_id, display_kind
  )
  values (
    v_template.address || '-' || substr(gen_random_uuid()::text, 1, 8),
    v_name,
    v_template.description,
    'instance', 'group', 'members', 'approved', false,
    false, auth.uid(), p_template_id,
    coalesce(v_template.instance_display_kind, 'term_table')
  )
  returning id into v_id;

  insert into dictionary_members (dictionary_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (auth.uid(), v_id, true, now());

  return v_id;
end;
$$;

grant execute on function create_group(uuid, text) to authenticated;

-- The owner adds someone by the email they signed up with. The new member
-- gets the group turned on.
create or replace function add_group_member(p_dictionary_id uuid, p_email text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not exists (
    select 1 from dictionary_members
    where dictionary_id = p_dictionary_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the group owner can add members.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No Stardust DS account uses that email yet. Ask them to sign up first.';
  end if;

  insert into dictionary_members (dictionary_id, user_id, role)
  values (p_dictionary_id, v_user_id, 'member')
  on conflict do nothing;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (v_user_id, p_dictionary_id, true, now())
  on conflict (user_id, dictionary_id) do update set opted_in = true, opted_in_at = now();
end;
$$;

grant execute on function add_group_member(uuid, text) to authenticated;

-- The owner removes a member, or a member leaves. The owner stays.
create or replace function remove_group_member(p_dictionary_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user_id != auth.uid() and not exists (
    select 1 from dictionary_members
    where dictionary_id = p_dictionary_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the group owner can remove other members.';
  end if;

  delete from dictionary_members
  where dictionary_id = p_dictionary_id and user_id = p_user_id and role != 'owner';

  update user_dictionaries set opted_in = false
  where dictionary_id = p_dictionary_id and user_id = p_user_id;
end;
$$;

grant execute on function remove_group_member(uuid, uuid) to authenticated;

-- Members with a readable name: profile display name, else email.
create or replace function list_group_members(p_dictionary_id uuid)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer set search_path = public
as $$
  select m.user_id, coalesce(nullif(trim(p.display_name), ''), u.email), m.role
  from dictionary_members m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.dictionary_id = p_dictionary_id and is_dictionary_member(p_dictionary_id)
  order by m.role = 'owner' desc, m.created_at;
$$;

grant execute on function list_group_members(uuid) to authenticated;

-- After School DS: lesson plans and a theme calendar for an after-school
-- program, shared by the staff in a group.
insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values (
  'after-school-ds', 'After School DS',
  'Lesson plans and a theme calendar for an after-school program, shared with your staff. Make a group for your site and add your team.',
  'instance_template', 'group', 'members', 'approved', false, false,
  'After School', 'after_school'
)
on conflict (address) do nothing;

-- Daily lesson notes, Monday (1) to Friday (5). week_start is the Monday
-- of the week; null week_start is the group's lesson template, which new
-- weeks copy.
create table if not exists after_school_lessons (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  week_start date check (week_start is null or extract(isodow from week_start) = 1),
  weekday smallint not null check (weekday between 1 and 5),
  body text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create unique index if not exists after_school_lessons_day_idx
  on after_school_lessons(dictionary_id, coalesce(week_start, '0001-01-01'::date), weekday);

-- The theme calendar: one row per week, a theme and five activities.
create table if not exists after_school_weeks (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  theme text not null default '',
  activities text[] not null default array['', '', '', '', '']
    check (array_length(activities, 1) = 5),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (dictionary_id, week_start)
);

alter table after_school_lessons enable row level security;
alter table after_school_weeks enable row level security;

create policy "group members manage lessons"
  on after_school_lessons for all
  to authenticated
  using (is_dictionary_member(dictionary_id))
  with check (is_dictionary_member(dictionary_id));

create policy "group members manage the theme calendar"
  on after_school_weeks for all
  to authenticated
  using (is_dictionary_member(dictionary_id))
  with check (is_dictionary_member(dictionary_id));

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('after school'), ('ymca'), ('lessons'), ('calendar'), ('group'), ('kids')) as v(label)
where address = 'after-school-ds'
on conflict do nothing;

insert into terms (name)
values ('Lesson'), ('Lesson Template'), ('Theme'), ('Activity'), ('Group'), ('Member')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Lesson', 'The plan for one weekday, Monday to Friday.', 'noun'),
  ('Lesson Template', 'The week every new week starts from. Regenerate copies it into the five weeks shown.', 'noun'),
  ('Theme', 'What a week is about, typed into the calendar.', 'noun'),
  ('Activity', 'One of the five things planned for a week''s theme.', 'noun'),
  ('Group', 'One copy of After School DS shared by a site''s staff. Everything in it is visible to every member.', 'noun'),
  ('Member', 'Someone in a group. The owner adds members by the email they signed up with.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'after-school-ds'
on conflict (term_id, dictionary_id) do nothing;
