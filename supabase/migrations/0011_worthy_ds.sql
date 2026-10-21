-- Worthy DS: Urban Wolf Studio's betting system.
--
-- The rule: save half of every win. You can only re-bet new deposits or
-- the other 50% of wins, so every win locks in savings.
--
-- Entries (all timestamped, amounts in dollars):
--   deposit  money put on a gambling site, or ATM cash pulled to gamble
--            (sports, poker, any gambling)
--   win      profit from a winning bet
--   savings  money moved out of gambling into savings (should equal 50% of wins)
--   balance  a snapshot of the current gambling account balance
--
-- Loss is computed by the app, never stored:
--   loss = deposits - current balance - savings
--
-- Bet Stories: a memory of a bet with a date, an outcome, and optional
-- principle labels.

insert into dictionaries (
  address, name, description, kind, scope, status, locked, default_opt_in,
  instance_name_suffix, instance_display_kind
)
values (
  'worthy-ds', 'Worthy DS',
  'Save half of every win. Track deposits, wins, savings, and your balance, and keep your bet stories. Private to you.',
  'instance_template', 'personal', 'approved', false, false,
  'Worthy', 'worthy'
)
on conflict (address) do nothing;

create table if not exists worthy_entries (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'win', 'savings', 'balance')),
  amount numeric(14, 2) not null check (amount >= 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists worthy_entries_owner_idx
  on worthy_entries(dictionary_id, owner_user_id, occurred_at desc);

create table if not exists bet_stories (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  outcome text not null check (outcome in ('win', 'loss', 'missed', 'other')),
  body text not null check (length(trim(body)) > 0),
  principles text[] not null default '{}'
    check (principles <@ array['unique', 'present', 'open_minded', 'fun', 'good_reason']),
  created_at timestamptz not null default now()
);

create index if not exists bet_stories_owner_idx
  on bet_stories(dictionary_id, owner_user_id, occurred_on desc);

alter table worthy_entries enable row level security;
alter table bet_stories enable row level security;

create policy "users manage their own worthy entries"
  on worthy_entries for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from dictionaries d
      where d.id = worthy_entries.dictionary_id
        and d.owner_user_id = auth.uid()
        and d.display_kind = 'worthy'
    )
  );

create policy "users manage their own bet stories"
  on bet_stories for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from dictionaries d
      where d.id = bet_stories.dictionary_id
        and d.owner_user_id = auth.uid()
        and d.display_kind = 'worthy'
    )
  );

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('betting'), ('savings'), ('bet stories'), ('private')) as v(label)
where address = 'worthy-ds'
on conflict do nothing;

-- Worthy DS vocabulary.
insert into terms (name) values
  ('Deposit'), ('Win'), ('Balance'), ('Loss'), ('Bet Story'), ('Worthy Rule')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Deposit', 'Money put on a gambling site, or cash pulled from an ATM to gamble.', 'noun'),
  ('Win', 'Profit from a winning bet. Half of it goes to savings.', 'noun'),
  ('Balance', 'What is in your gambling account right now.', 'noun'),
  ('Loss', 'Deposits minus your current balance minus your savings. Worthy works it out for you.', 'noun'),
  ('Bet Story', 'A memory of a bet: when it happened, how it went, and what you learned.', 'noun'),
  ('Worthy Rule', 'Save half of every win. Bet only new deposits or the other half of your wins, so every win locks in savings.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'worthy-ds'
on conflict (term_id, dictionary_id) do nothing;
