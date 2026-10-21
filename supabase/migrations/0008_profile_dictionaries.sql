-- Profile dictionaries. Every user gets two, created automatically:
--
--   Private Profile: registration and payment info. Owner-only, never
--     discoverable. Payment holds a placeholder for a future payment
--     processor's customer id. Raw card numbers are never stored here, and
--     a trigger rejects any value shaped like one.
--   Public Profile: contact info, location, and profile info. Signed-in
--     users can read its public fields, and its labels make it findable in
--     dictionary search. Each field defaults to public or private and the
--     owner can flip it.
--
-- Both are instance templates (same system as Night DS) and locked on.
-- Fields are simple name/value rows in profile_fields. City defaults to
-- Seattle: Stardust DS starts in one city.

insert into dictionaries (
  address, name, description, kind, scope, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values
  ('private-profile', 'Private Profile',
   'Your registration and payment info. Only you can see it.',
   'instance_template', 'personal', 'approved', true, true,
   'Private Profile', 'profile'),
  ('public-profile', 'Public Profile',
   'How other sparks find and reach you: contact info, neighborhood and city, and who you are. You choose which fields are public.',
   'instance_template', 'personal', 'approved', true, true,
   'Public Profile', 'profile')
on conflict (address) do nothing;

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('profile'), ('person'), ('contact')) as v(label)
where address = 'public-profile'
on conflict do nothing;

-- Instance dictionaries were readable by anyone, so the names of other
-- users' Notes or Private Profile dictionaries could be listed. Now an
-- instance is readable by its owner, plus Public Profiles by any signed-in
-- user. The template id comes from a security definer helper so the policy
-- never queries dictionaries from inside its own policy.
create or replace function public_profile_template_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select id from dictionaries where address = 'public-profile';
$$;

drop policy if exists "dictionaries are publicly readable when approved" on dictionaries;

create policy "dictionaries are readable when approved and discoverable"
  on dictionaries for select
  using (
    status = 'approved'
    and (
      kind != 'instance'
      or owner_user_id = auth.uid()
      or (auth.uid() is not null and template_id = public_profile_template_id())
    )
  );

create table if not exists profile_fields (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  value text not null default '' check (length(value) <= 500),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dictionary_id, name)
);

create index if not exists profile_fields_dictionary_idx on profile_fields(dictionary_id);

alter table profile_fields enable row level security;

create policy "users read their own profile fields"
  on profile_fields for select
  to authenticated
  using (owner_user_id = auth.uid());

-- Public fields of a Public Profile are readable by any signed-in user.
-- Fields in a Private Profile can never be public (enforced below).
create policy "public profile fields readable by signed-in users"
  on profile_fields for select
  to authenticated
  using (visibility = 'public');

-- Writes only land in a profile dictionary the caller owns.
create policy "users write fields in their own profiles"
  on profile_fields for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from dictionaries d
      where d.id = profile_fields.dictionary_id
        and d.owner_user_id = auth.uid()
        and d.display_kind = 'profile'
    )
  );

create policy "users update fields in their own profiles"
  on profile_fields for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from dictionaries d
      where d.id = profile_fields.dictionary_id
        and d.owner_user_id = auth.uid()
        and d.display_kind = 'profile'
    )
  );

create policy "users delete fields in their own profiles"
  on profile_fields for delete
  to authenticated
  using (owner_user_id = auth.uid());

create or replace function profile_fields_guard()
returns trigger
language plpgsql
as $$
begin
  -- 13 to 19 digits, optionally split by spaces or dashes, is card-shaped.
  if new.value ~ '(\d[ -]?){12,18}\d' then
    raise exception 'Card numbers can''t be stored in a profile.';
  end if;

  if exists (
    select 1 from dictionaries d
    join dictionaries t on t.id = d.template_id
    where d.id = new.dictionary_id and t.address = 'private-profile'
  ) then
    new.visibility := 'private';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profile_fields_guard
  before insert or update on profile_fields
  for each row execute function profile_fields_guard();

-- Creates both profile instances for a user and fills in default fields.
-- Safe to call more than once.
create or replace function provision_profiles(p_user_id uuid, p_display_name text, p_email text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_private uuid;
  v_public uuid;
begin
  v_private := create_personal_instance(
    (select id from dictionaries where address = 'private-profile'), p_user_id, p_display_name);
  v_public := create_personal_instance(
    (select id from dictionaries where address = 'public-profile'), p_user_id, p_display_name);

  insert into profile_fields (dictionary_id, owner_user_id, name, value, visibility, position)
  values
    (v_private, p_user_id, 'Legal Name', '', 'private', 1),
    (v_private, p_user_id, 'Registration Email', coalesce(p_email, ''), 'private', 2),
    (v_private, p_user_id, 'Birthday', '', 'private', 3),
    (v_private, p_user_id, 'Payment Customer ID', '', 'private', 4),
    (v_public, p_user_id, 'Name', coalesce(p_display_name, ''), 'public', 1),
    (v_public, p_user_id, 'Email Address', coalesce(p_email, ''), 'private', 2),
    (v_public, p_user_id, 'Phone Number', '', 'private', 3),
    (v_public, p_user_id, 'Neighborhood', '', 'public', 4),
    (v_public, p_user_id, 'City', 'Seattle', 'public', 5),
    (v_public, p_user_id, 'Age', '', 'private', 6),
    (v_public, p_user_id, 'Gender', '', 'private', 7),
    (v_public, p_user_id, 'Relationship Status', '', 'private', 8)
  on conflict (dictionary_id, name) do nothing;

  insert into dictionary_labels (dictionary_id, label)
  values (v_public, 'person'), (v_public, 'profile'), (v_public, 'seattle')
  on conflict do nothing;
end;
$$;

revoke execute on function provision_profiles(uuid, text, text) from public, anon, authenticated;

-- New users: Core + Stardust on, plus both profiles.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');

  insert into user_dictionaries (user_id, dictionary_id, opted_in)
  select new.id, id, true from dictionaries where address in ('core', 'stardust');

  perform provision_profiles(new.id, new.raw_user_meta_data->>'display_name', new.email);
  return new;
end;
$$;

-- Backfill existing users.
select provision_profiles(u.id, p.display_name, u.email)
from auth.users u
left join profiles p on p.id = u.id;
