-- Accounts DS: a private bank account for more than money.
--
-- Nine accounts in three groups, the embodied spectrum from the Matrix up
-- to Imagination:
--   Matrix:      Savings, Home, Avatar
--   Life:        Friends, Community, Hobbies
--   Imagination: Ideas, Reflections, Memories
--
-- Only the template is discoverable. Adding it creates the user's own
-- "<Name>'s Accounts" instance, same system as Night DS. No time limits:
-- entries stay until the owner deletes them. An entry has an optional
-- amount (money, minutes, a count, whatever the owner tracks) and a note.

insert into dictionaries (
  address, name, description, kind, scope, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values (
  'accounts-ds', 'Accounts DS',
  'Nine accounts for your whole life: Savings, Home, Avatar, Friends, Community, Hobbies, Ideas, Reflections, and Memories. Private to you.',
  'instance_template', 'personal', 'approved', false, false,
  'Accounts', 'accounts'
)
on conflict (address) do nothing;

create table if not exists account_entries (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in (
    'Savings', 'Home', 'Avatar',
    'Friends', 'Community', 'Hobbies',
    'Ideas', 'Reflections', 'Memories'
  )),
  amount numeric(14, 2),
  note text,
  created_at timestamptz not null default now(),
  check (amount is not null or (note is not null and length(trim(note)) > 0))
);

create index if not exists account_entries_owner_idx
  on account_entries(dictionary_id, owner_user_id, account, created_at desc);

alter table account_entries enable row level security;

create policy "users manage their own account entries"
  on account_entries for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from dictionaries d
      where d.id = account_entries.dictionary_id
        and d.owner_user_id = auth.uid()
        and d.display_kind = 'accounts'
    )
  );

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('accounts'), ('savings'), ('friends'), ('memories'), ('private')) as v(label)
where address = 'accounts-ds'
on conflict do nothing;

-- Accounts DS vocabulary. The nine account words and their groups are
-- Stardust words (see 0012); these are the words for using an account.
insert into terms (name) values ('Entry'), ('Balance') on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Entry', 'One dated line in an account: an amount, a note, or both.', 'noun'),
  ('Balance', 'What an account holds: the sum of its amounts and how many entries it has.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'accounts-ds'
on conflict (term_id, dictionary_id) do nothing;
