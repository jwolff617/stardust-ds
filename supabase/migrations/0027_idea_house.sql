-- Idea House DS on Posts (0022): the Idea House Fund's story, a private
-- application, decisions, and the public ledger. Applications are a
-- stewards_only kind: only the applicant and the board's stewards (the
-- fund's judges) ever see one. The ledger stays in the fund's Google Sheet;
-- the app reads its CSV link from the board settings. Grants are listed by
-- ID number, never by name.
--
-- Needs 0022.

insert into dictionaries (
  address, name, description, kind, scope, visibility, status, locked, default_opt_in, display_kind
)
values (
  'idea-house-ds', 'Idea House',
  'The Idea House Fund: small in-kind grants for people with an idea, starting with Recovery Cafe. Apply privately. The public ledger lists grants by ID, never by name.',
  'topical', 'shared', 'public', 'approved', false, false, 'idea_house'
)
on conflict (address) do update set display_kind = excluded.display_kind, description = excluded.description;

insert into post_boards (dictionary_id, intro, settings)
select id,
  'The Idea House Fund gives small grants of things, not cash (tools, a laptop, a bus pass, materials), to people with an idea, starting with Recovery Cafe members. Your application is seen only by you and the fund''s judges.',
  jsonb_build_object(
    'ledgerCsv', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9YRhWdvTOKgAl0bJpk7iNPdqe5O1I1JZDrDkEn-Yb85QTpAPvIxdsavtEd8CRQziX__jDoEpV2Vka/pub?gid=0&single=true&output=csv',
    'nextReview', '',
    'publicPage', 'https://urbanwolfstudio.net/idea-house'
  )
from dictionaries where address = 'idea-house-ds'
on conflict (dictionary_id) do nothing;

insert into post_kinds (dictionary_id, name, description, position, expires_days, stewards_only)
select d.id, 'Application', 'Your idea, what you need, and how it helps. Only you and the fund''s judges see it.', 1, null, true
from dictionaries d
where d.address = 'idea-house-ds'
on conflict (dictionary_id, name) do nothing;

insert into dictionary_labels (dictionary_id, label)
select id, v.label
from dictionaries
cross join (values ('grant'), ('fund'), ('idea'), ('recovery'), ('nonprofit'), ('seattle')) as v(label)
where address = 'idea-house-ds'
on conflict do nothing;

-- A judge's decision on an application. The applicant reads it; only
-- stewards of the board write it.
create table if not exists idea_house_decisions (
  post_id uuid primary key references posts(id) on delete cascade,
  status text not null default 'reviewing' check (status in ('reviewing', 'granted', 'not_this_time')),
  -- The grant's ID on the public ledger, like IH-008.
  grant_id text not null default '' check (length(grant_id) <= 20),
  -- A note to the applicant.
  note text not null default '' check (length(note) <= 1000),
  decided_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table idea_house_decisions enable row level security;

drop policy if exists "applicants and judges read decisions" on idea_house_decisions;
create policy "applicants and judges read decisions"
  on idea_house_decisions for select to authenticated
  using (post_author(post_id) = auth.uid() or is_steward(post_board(post_id)));

drop policy if exists "judges write decisions" on idea_house_decisions;
create policy "judges write decisions"
  on idea_house_decisions for insert to authenticated
  with check (is_steward(post_board(post_id)) and decided_by = auth.uid());

drop policy if exists "judges change decisions" on idea_house_decisions;
create policy "judges change decisions"
  on idea_house_decisions for update to authenticated
  using (is_steward(post_board(post_id)))
  with check (is_steward(post_board(post_id)) and decided_by = auth.uid());

insert into terms (name) values
  ('Idea House Fund'), ('Application'), ('Grant'), ('Ledger'), ('Judge'), ('In-Kind')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Idea House Fund', 'A Seattle nonprofit that gives small in-kind grants (things, not cash) to low-income people with an idea, starting with Recovery Cafe members.', 'noun'),
  ('Application', 'Your idea, what you need, and how it helps, seen only by you and the fund''s judges.', 'more'),
  ('Grant', 'What the fund gives: a thing you need for your idea. Listed on the public ledger by ID number, never by name.', 'noun'),
  ('Ledger', 'The fund''s public record of every grant, by ID number, kept in its own sheet.', 'noun'),
  ('Judge', 'A steward of Idea House who reads applications, asks questions, and decides.', 'noun'),
  ('In-Kind', 'Given as a thing, like tools or a laptop, not as money.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'idea-house-ds'
on conflict (term_id, dictionary_id) do nothing;
