-- Events, connecting, and the inbox as notices (2026-11-24).
--
-- 1. An event is a group (a shared journal) with a name, a body, a time,
--    and invited people. Invites land in each person's inbox.
-- 2. Contacting a match makes a two-person group with a shared journal.
--    Its time frame defaults to life. Same for idea partners and dating.
-- 3. The inbox holds invites and notices only. Conversation lives in the
--    group journals. Old hello threads stay readable.

-- Groups and events carry a time frame and, for events, a start and place.
alter table dictionaries
  add column if not exists time_frame text not null default 'life'
    check (time_frame in ('day', 'week', 'month', 'year', 'decade', 'life')),
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists place text not null default '' check (length(place) <= 120),
  add column if not exists is_event boolean not null default false;

-- Notices: invites and news, one row per person told.
create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('invite', 'connect', 'notice')),
  from_user_id uuid references auth.users(id) on delete set null,
  from_name text not null default '',
  dictionary_id uuid references dictionaries(id) on delete cascade,
  title text not null default '' check (length(title) <= 200),
  body text not null default '' check (length(body) <= 2000),
  answer text check (answer in ('yes', 'no')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notices_user_idx on notices (user_id, created_at desc);
alter table notices enable row level security;
drop policy if exists "sparks read their notices" on notices;
create policy "sparks read their notices" on notices for select to authenticated using (user_id = auth.uid());
drop policy if exists "sparks mark their notices" on notices;
create policy "sparks mark their notices" on notices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "sparks clear their notices" on notices;
create policy "sparks clear their notices" on notices for delete to authenticated using (user_id = auth.uid());

-- Who to tell, found by email or by name. Null when nobody matches.
create or replace function find_spark(p_who text) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from auth.users where lower(email) = lower(trim(p_who)) limit 1),
    (select id from profiles where lower(trim(display_name)) = lower(trim(p_who)) limit 1)
  );
$$;
revoke execute on function find_spark(text) from public, anon;

-- Make an event: a members-only journal with a time, place, and invites.
-- p_people: emails or names, comma separated. Returns the event's id.
create or replace function create_event(p_name text, p_body text, p_starts timestamptz, p_place text, p_people text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_me uuid := auth.uid();
  v_my_name text;
  v_id uuid;
  v_who text;
  v_user uuid;
begin
  if v_me is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give your event a name.'; end if;
  select coalesce(nullif(display_name, ''), 'A spark') into v_my_name from profiles where id = v_me;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind, time_frame, starts_at, place, is_event)
  values ('event-' || substr(gen_random_uuid()::text, 1, 12), v_name, left(coalesce(p_body, ''), 2000), 'instance',
          'group', 'members', 'approved', false, false, v_me, 'journal', 'day', p_starts, left(coalesce(p_place, ''), 120), true)
  returning id into v_id;
  insert into dictionary_members (dictionary_id, user_id, role) values (v_id, v_me, 'owner');
  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (v_me, v_id, true, now());
  if trim(coalesce(p_body, '')) <> '' then
    insert into journal_entries (dictionary_id, owner_user_id, body, place) values (v_id, v_me, trim(p_body), left(coalesce(p_place, ''), 120));
  end if;

  for v_who in select trim(x) from regexp_split_to_table(coalesce(p_people, ''), '\s*,\s*') x where trim(x) <> '' loop
    v_user := find_spark(v_who);
    if v_user is not null and v_user <> v_me then
      insert into notices (user_id, kind, from_user_id, from_name, dictionary_id, title, body)
      values (v_user, 'invite', v_me, v_my_name, v_id, v_name,
              concat_ws(' · ', to_char(p_starts at time zone 'America/Los_Angeles', 'Dy Mon DD, HH12:MI AM'), nullif(trim(p_place), '')));
    end if;
  end loop;
  return v_id;
end;
$$;
revoke execute on function create_event(text, text, timestamptz, text, text) from public, anon;
grant execute on function create_event(text, text, timestamptz, text, text) to authenticated;

-- Answer an invite or a connect: yes joins the group, no just answers.
create or replace function answer_notice(p_notice uuid, p_yes boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_n notices;
  v_name text;
begin
  select * into v_n from notices where id = p_notice and user_id = auth.uid();
  if v_n.id is null then raise exception 'That invite is gone.'; end if;
  update notices set answer = case when p_yes then 'yes' else 'no' end, read_at = coalesce(read_at, now()) where id = p_notice;
  if p_yes and v_n.dictionary_id is not null then
    insert into dictionary_members (dictionary_id, user_id, role) values (v_n.dictionary_id, auth.uid(), 'member') on conflict do nothing;
    insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_n.dictionary_id, true, now())
      on conflict (user_id, dictionary_id) do update set opted_in = true, opted_in_at = now();
  end if;
  -- Tell the sender.
  if v_n.from_user_id is not null then
    select coalesce(nullif(display_name, ''), 'A spark') into v_name from profiles where id = auth.uid();
    insert into notices (user_id, kind, from_user_id, from_name, dictionary_id, title, body)
    values (v_n.from_user_id, 'notice', auth.uid(), v_name, v_n.dictionary_id, v_n.title,
            v_name || case when p_yes then ' said yes.' else ' said no, thank you.' end);
  end if;
  return v_n.dictionary_id;
end;
$$;
revoke execute on function answer_notice(uuid, boolean) from public, anon;
grant execute on function answer_notice(uuid, boolean) to authenticated;

-- Contact a match: a two-person group with a shared journal, named for
-- the two of you and what you matched on. They get a connect notice.
create or replace function connect_match(p_entry uuid, p_note text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_e profile_entries;
  v_my_name text;
  v_id uuid;
begin
  if v_me is null then raise exception 'Log in first.'; end if;
  select * into v_e from profile_entries where id = p_entry and hidden_at is null and not paused;
  if v_e.id is null then raise exception 'That entry isn''t there anymore.'; end if;
  if v_e.owner_user_id = v_me then raise exception 'That one is yours.'; end if;
  select coalesce(nullif(display_name, ''), 'A spark') into v_my_name from profiles where id = v_me;

  -- Already connected on this entry: open the same group.
  select d.id into v_id from dictionaries d
  where d.address like 'connect-%' and d.description = p_entry::text
    and exists (select 1 from dictionary_members m where m.dictionary_id = d.id and m.user_id = v_me)
  limit 1;
  if v_id is not null then return v_id; end if;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind, time_frame)
  values ('connect-' || substr(gen_random_uuid()::text, 1, 12),
          left(v_my_name || ' + ' || coalesce(nullif(v_e.owner_name, ''), 'a spark') || ': ' || v_e.word, 80),
          p_entry::text, 'instance', 'group', 'members', 'approved', false, false, v_me, 'journal', 'life')
  returning id into v_id;
  insert into dictionary_members (dictionary_id, user_id, role) values (v_id, v_me, 'owner');
  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (v_me, v_id, true, now());
  if trim(coalesce(p_note, '')) <> '' then
    insert into journal_entries (dictionary_id, owner_user_id, body) values (v_id, v_me, left(trim(p_note), 2000));
  end if;
  insert into notices (user_id, kind, from_user_id, from_name, dictionary_id, title, body)
  values (v_e.owner_user_id, 'connect', v_me, v_my_name, v_id, v_e.word,
          coalesce(nullif(left(trim(p_note), 300), ''), v_my_name || ' matched with your ' || v_e.kind || ' "' || v_e.word || '" and wants to talk.'));
  return v_id;
end;
$$;
revoke execute on function connect_match(uuid, text) from public, anon;
grant execute on function connect_match(uuid, text) to authenticated;

-- Members can read a group's time frame and event details (they already
-- read the dictionary row through existing policies).
