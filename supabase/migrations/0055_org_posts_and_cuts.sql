-- Org announcements, and the last cuts (2026-11-23).
--
-- 1. An org posts dated announcements under its board. Anyone can read
--    them; its admins write, edit, and delete them.
-- 2. After School, Address Book, Birthdays, and custom dictionaries aren't
--    Stardust things. They're hidden like the other cuts (status
--    'rejected'); their data stays until the delete migration on or after
--    2026-12-22.

create table if not exists organization_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_posts_org_idx on organization_posts (organization_id, created_at desc);
alter table organization_posts enable row level security;

drop policy if exists "anyone reads org posts" on organization_posts;
create policy "anyone reads org posts" on organization_posts for select
  using (exists (select 1 from organizations o where o.id = organization_id and o.visibility = 'public'));
drop policy if exists "org admins write posts" on organization_posts;
create policy "org admins write posts" on organization_posts for insert to authenticated
  with check (is_org_admin(organization_id) and author_user_id = auth.uid());
drop policy if exists "org admins edit posts" on organization_posts;
create policy "org admins edit posts" on organization_posts for update to authenticated
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
drop policy if exists "org admins delete posts" on organization_posts;
create policy "org admins delete posts" on organization_posts for delete to authenticated
  using (is_org_admin(organization_id));

-- Orgs are always public now.
update organizations set visibility = 'public' where visibility <> 'public';

-- 2. Cuts ------------------------------------------------------------------------

update dictionaries set status = 'rejected', locked = false
where address in ('after-school-ds', 'address-book-ds', 'birthdays-ds')
   or template_id in (select id from dictionaries where address in ('after-school-ds', 'address-book-ds', 'birthdays-ds'))
   or display_kind = 'custom';

update user_dictionaries set opted_in = false
where dictionary_id in (select id from dictionaries where status = 'rejected');

-- 3. Tickers -------------------------------------------------------------------
-- A short code (2 to 5 letters or digits, starting with a letter, like
-- "md") that the shortcut box opens. Each points at an organization. Only
-- moderators assign them. None are assigned yet. Single letters and
-- p-codes belong to the app (j journals, n notes, pi idea profile...).

create table if not exists tickers (
  code text primary key check (code ~ '^[a-z][a-z0-9]{1,4}$' and code not in ('pp', 'pi', 'pj', 'pr')),
  organization_id uuid not null references organizations(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now()
);
alter table tickers enable row level security;
drop policy if exists "anyone reads tickers" on tickers;
create policy "anyone reads tickers" on tickers for select using (true);
drop policy if exists "moderators assign tickers" on tickers;
create policy "moderators assign tickers" on tickers for all to authenticated
  using (is_moderator()) with check (is_moderator());

-- To assign one (moderator, in SQL for now):
--   insert into tickers (code, organization_id, assigned_by, note)
--   select 'md', id, auth.uid(), 'sold 2027-01-01' from organizations where slug = '...';
