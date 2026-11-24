-- My Nouns (2026-11-23): how often and how lately each spark opens each of
-- their nouns, and which they've starred. Feeds the My Nouns box (Recent,
-- Top, Starred) and the My Nouns thing.

create table if not exists noun_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (length(kind) <= 20),
  ref_id uuid not null,
  opens integer not null default 0,
  last_opened_at timestamptz,
  favorite boolean not null default false,
  primary key (user_id, kind, ref_id)
);
create index if not exists noun_visits_recent_idx on noun_visits (user_id, last_opened_at desc);
alter table noun_visits enable row level security;
drop policy if exists "sparks keep their own visits" on noun_visits;
create policy "sparks keep their own visits" on noun_visits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One open: counts it and stamps the time.
create or replace function visit_noun(p_kind text, p_ref uuid)
returns void language sql security invoker set search_path = public as $$
  insert into noun_visits (user_id, kind, ref_id, opens, last_opened_at)
  values (auth.uid(), p_kind, p_ref, 1, now())
  on conflict (user_id, kind, ref_id)
  do update set opens = noun_visits.opens + 1, last_opened_at = now();
$$;
grant execute on function visit_noun(text, uuid) to authenticated;

create or replace function star_noun(p_kind text, p_ref uuid, p_on boolean)
returns void language sql security invoker set search_path = public as $$
  insert into noun_visits (user_id, kind, ref_id, favorite)
  values (auth.uid(), p_kind, p_ref, p_on)
  on conflict (user_id, kind, ref_id) do update set favorite = p_on;
$$;
grant execute on function star_noun(text, uuid, boolean) to authenticated;
