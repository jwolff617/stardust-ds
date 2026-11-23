-- Create picks a type (2026-11-23).
--
-- A word you create is one of: a noun (a plain word and body, kept here in
-- my_words), an org, an idea, a job, a resource, a person (profile entries
-- and organizations, as before), or a notes, journal, or group notebook
-- (dictionaries, as before). This adds the noun's table, and lets the inbox
-- mark hellos read.

create table if not exists my_words (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default '',
  word text not null check (length(trim(word)) between 1 and 120),
  body text not null default '' check (length(body) <= 20000),
  place text not null default '' check (length(place) <= 120),
  people text not null default '' check (length(people) <= 300),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists my_words_owner_idx on my_words (owner_user_id, word);
alter table my_words enable row level security;

drop policy if exists "sparks read words" on my_words;
create policy "sparks read words" on my_words for select
  using (owner_user_id = auth.uid() or visibility = 'public');
drop policy if exists "sparks write their own words" on my_words;
create policy "sparks write their own words" on my_words for all to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create or replace function my_words_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.owner_name := coalesce((select nullif(display_name, '') from profiles where id = new.owner_user_id), '');
  if tg_op = 'INSERT' and (select count(*) from my_words where owner_user_id = new.owner_user_id) >= 2000 then
    raise exception 'You have 2000 words. Delete one to make another.';
  end if;
  return new;
end;
$$;
drop trigger if exists my_words_stamp on my_words;
create trigger my_words_stamp before insert or update on my_words for each row execute function my_words_stamp();

-- The inbox marks the other side's messages read.
create or replace function mark_hellos_read(p_entry uuid, p_asker uuid)
returns void language sql security definer set search_path = public as $$
  update profile_entry_messages set read_at = now()
  where entry_id = p_entry and asker_user_id = p_asker and read_at is null
    and sender_user_id <> auth.uid()
    and (asker_user_id = auth.uid() or entry_owner(entry_id) = auth.uid());
$$;
grant execute on function mark_hellos_read(uuid, uuid) to authenticated;

-- Search finds your nouns, and public ones.
create or replace function stardust_search(
  p_word text default '',
  p_body text default '',
  p_place text default '',
  p_people text default '',
  p_after timestamptz default null,
  p_before timestamptz default null,
  p_visibility text default '',
  p_limit int default 30
)
returns table (kind text, id uuid, word text, body text, place text, people text, visibility text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  with found as (
    select (case when def.part_of_speech in ('noun', 'verb') then def.part_of_speech else 'word' end)::text as kind,
           def.id, t.name as word, def.body, ''::text as place, ''::text as people, 'public'::text as visibility, def.created_at
    from definitions def
    join terms t on t.id = def.term_id
    join dictionaries d on d.id = def.dictionary_id
    where d.status = 'approved' and d.scope = 'shared' and d.kind <> 'instance'

    union all
    select 'mine', w.id, w.word, w.body, w.place, nullif(concat_ws(', ', nullif(w.people, ''), nullif(w.owner_name, '')), ''),
           w.visibility, w.created_at
    from my_words w

    union all
    select 'note', n.id, left(regexp_replace(n.body, '\s+', ' ', 'g'), 60), n.body, n.place,
           nullif(concat_ws(', ', nullif(n.people, ''), p.display_name), ''),
           case when d.scope = 'group' then 'group' else n.visibility end, n.created_at
    from notes n
    join dictionaries d on d.id = n.dictionary_id
    left join profiles p on p.id = n.owner_user_id

    union all
    select 'journal', j.id, d.name, j.body, j.place,
           nullif(concat_ws(', ', nullif(j.people, ''), p.display_name), ''),
           case when d.scope = 'group' then 'group' when d.address = 'bet-stories' then 'public' else 'private' end, j.created_at
    from journal_entries j
    join dictionaries d on d.id = j.dictionary_id
    left join profiles p on p.id = j.owner_user_id

    union all
    select e.kind, e.id, e.word, e.body, e.place,
           nullif(concat_ws(', ', nullif(e.people, ''), nullif(e.owner_name, '')), ''),
           e.visibility, e.created_at
    from profile_entries e
    where e.hidden_at is null

    union all
    select 'profile', pr.id, coalesce(nullif(pr.display_name, ''), 'A spark'),
           string_agg(f.name || ': ' || f.value, ' · ' order by f.position), '', pr.display_name, 'public', min(f.created_at)
    from profile_fields f
    join profiles pr on pr.id = f.owner_user_id
    where f.visibility = 'public' and f.value <> ''
    group by pr.id, pr.display_name

    union all
    select 'organization', o.id, o.name, concat_ws(' · ', o.kind, nullif(o.about, '')), o.neighborhood, o.people, o.visibility, o.created_at
    from organizations o
  )
  select f.kind, f.id, f.word, f.body, f.place, coalesce(f.people, ''), f.visibility, f.created_at
  from found f
  where (coalesce(p_word, '') = '' or f.word ilike '%' || trim(p_word) || '%')
    and stardust_has_words(f.word || ' ' || f.body, p_body)
    and (coalesce(p_place, '') = '' or f.place ilike '%' || trim(p_place) || '%' or f.body ilike '%' || trim(p_place) || '%')
    and (coalesce(p_people, '') = '' or coalesce(f.people, '') ilike '%' || trim(p_people) || '%')
    and (p_after is null or f.created_at >= p_after)
    and (p_before is null or f.created_at < p_before)
    and (coalesce(p_visibility, '') = '' or f.visibility = lower(trim(p_visibility)))
  order by
    (lower(f.word) = lower(trim(coalesce(p_word, '')))) desc,
    (f.word ilike trim(coalesce(p_word, '')) || '%') desc,
    f.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Phone swaps work on hello threads about profile entries ("e:<entry>:<asker>").
create or replace function thread_other(p_thread text)
returns uuid
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_kind text := split_part(p_thread, ':', 1);
  v_thing uuid := split_part(p_thread, ':', 2)::uuid;
  v_asker uuid := split_part(p_thread, ':', 3)::uuid;
  v_owner uuid;
begin
  if v_kind = 'd' then
    select owner_user_id into v_owner from dictionaries where id = v_thing;
  elsif v_kind = 'p' then
    select author_user_id into v_owner from posts where id = v_thing;
  elsif v_kind = 'e' then
    select owner_user_id into v_owner from profile_entries where id = v_thing;
    -- Only once they've actually talked.
    if not exists (select 1 from profile_entry_messages where entry_id = v_thing and asker_user_id = v_asker) then
      return null;
    end if;
  end if;
  if v_owner is null or v_owner = v_asker then return null; end if;
  if auth.uid() = v_asker then return v_owner; end if;
  if auth.uid() = v_owner then return v_asker; end if;
  return null;
end;
$$;
revoke execute on function thread_other(text) from public, anon;
