-- Things have fixed visibility, ideas are public journals, and search ranks
-- by fit (2026-11-23).
--
--   public    idea, org, resource, profile
--   members   group
--   private   journal, notes, inbox, settings
--
-- An idea is a journal anyone can read: its owner writes entries over time.
-- Notes are always private. Search scores every result: the exact word
-- first, then how many tags (location, time) and body words it matches.
-- An exact dictionary or notebook name opens it.

-- 1. Notes are private -----------------------------------------------------------

update notes set visibility = 'private' where visibility <> 'private';
alter table notes drop constraint if exists notes_always_private;
alter table notes add constraint notes_always_private check (visibility = 'private');

-- 2. Ideas: public journals ------------------------------------------------------

create or replace function create_idea(p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give your idea a name.'; end if;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and address like 'idea-%') >= 50 then
    raise exception 'You have 50 ideas. Delete one to make another.';
  end if;
  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in, owner_user_id, display_kind)
  values ('idea-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance', 'personal', 'public', 'approved', false, false, auth.uid(), 'journal')
  returning id into v_id;
  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;
revoke execute on function create_idea(text) from public, anon;
grant execute on function create_idea(text) to authenticated;

create or replace function is_idea(p_dictionary uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from dictionaries where id = p_dictionary and address like 'idea-%' and status = 'approved');
$$;
grant execute on function is_idea(uuid) to anon, authenticated;

drop policy if exists "anyone reads ideas" on dictionaries;
create policy "anyone reads ideas" on dictionaries for select
  using (address like 'idea-%' and status = 'approved');

drop policy if exists "anyone reads idea entries" on journal_entries;
create policy "anyone reads idea entries" on journal_entries for select
  using (is_idea(dictionary_id));

-- Ideas that were single profile cards become idea journals with that text
-- as their first entry. The profile keeps its idea match line.
do $$
declare r record; v_id uuid;
begin
  for r in select * from profile_entries e
           where e.kind = 'idea' and e.side = 'offer' and e.review is distinct from 'removed'
             and not exists (select 1 from dictionaries d where d.owner_user_id = e.owner_user_id and d.address like 'idea-%' and lower(d.name) = lower(e.word))
  loop
    insert into dictionaries (address, name, kind, scope, visibility, status, locked, default_opt_in, owner_user_id, display_kind)
    values ('idea-' || substr(gen_random_uuid()::text, 1, 12), left(r.word, 80), 'instance', 'personal', 'public', 'approved', false, false, r.owner_user_id, 'journal')
    returning id into v_id;
    insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (r.owner_user_id, v_id, true, now())
    on conflict (user_id, dictionary_id) do nothing;
    if trim(r.body) <> '' then
      insert into journal_entries (dictionary_id, owner_user_id, body, place, people, created_at)
      values (v_id, r.owner_user_id, r.body, r.place, r.people, r.created_at);
    end if;
  end loop;
end $$;

-- 3. Search, ranked by fit ------------------------------------------------------

drop function if exists stardust_search(text, text, text, text, timestamptz, timestamptz, text, int);
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
returns table (kind text, id uuid, word text, body text, place text, people text, visibility text, created_at timestamptz, score int)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select lower(trim(coalesce(p_word, ''))) as w,
           array(select distinct x from regexp_split_to_table(lower(coalesce(p_body, '') || ' ' || coalesce(p_word, '')), '[^a-z0-9]+') x where length(x) > 2) as words,
           lower(trim(coalesce(p_place, ''))) as place,
           lower(trim(coalesce(p_people, ''))) as people
  ),
  found as (
    -- Notebooks and ideas, by name: an exact name opens it.
    select 'notebook'::text as kind, d.id, d.name as word, coalesce(d.description, '') as body, ''::text as place, ''::text as people,
           case when d.address like 'idea-%' then 'public' when d.scope = 'group' then 'group' else 'private' end as visibility, d.created_at
    from dictionaries d
    where d.status = 'approved' and d.display_kind in ('journal', 'notes_list')
      and (d.address like 'idea-%' or d.address like 'notebook-%' or d.address = 'bet-stories' or d.scope = 'group')

    union all
    select (case when def.part_of_speech in ('noun', 'verb') then def.part_of_speech else 'word' end)::text,
           def.id, t.name, def.body, '', '', 'public', def.created_at
    from definitions def join terms t on t.id = def.term_id join dictionaries d on d.id = def.dictionary_id
    where d.status = 'approved' and d.scope = 'shared' and d.kind <> 'instance'

    union all
    select 'mine', w.id, w.word, w.body, w.place, w.people, w.visibility, w.created_at from my_words w

    union all
    select 'note', n.id, left(regexp_replace(n.body, '\s+', ' ', 'g'), 60), n.body, n.place, n.people, 'private', n.created_at
    from notes n

    union all
    select case when d.address like 'idea-%' then 'idea-entry' else 'journal' end, j.id, d.name, j.body, j.place,
           nullif(concat_ws(', ', nullif(j.people, ''), p.display_name), ''),
           case when d.address like 'idea-%' or d.address = 'bet-stories' then 'public' when d.scope = 'group' then 'group' else 'private' end,
           j.created_at
    from journal_entries j join dictionaries d on d.id = j.dictionary_id left join profiles p on p.id = j.owner_user_id

    union all
    select e.kind, e.id, e.word, e.body, e.place, nullif(concat_ws(', ', nullif(e.people, ''), nullif(e.owner_name, '')), ''), e.visibility, e.created_at
    from profile_entries e where e.hidden_at is null

    union all
    select 'profile', pr.id, coalesce(nullif(pr.display_name, ''), 'A spark'),
           string_agg(f.name || ': ' || f.value, ' · ' order by f.position), '', pr.display_name, 'public', min(f.created_at)
    from profile_fields f join profiles pr on pr.id = f.owner_user_id
    where f.visibility = 'public' and f.value <> ''
    group by pr.id, pr.display_name

    union all
    select 'organization', o.id, o.name, concat_ws(' · ', o.kind, nullif(o.about, '')), o.neighborhood, o.people, 'public', o.created_at
    from organizations o
  ),
  scored as (
    select f.*,
      (case when q.w <> '' and lower(f.word) = q.w then 100
            when q.w <> '' and lower(regexp_replace(f.word, '^the\s+', '', 'i')) = regexp_replace(q.w, '^the\s+', '') then 100
            when q.w <> '' and lower(f.word) like q.w || '%' then 40
            when q.w <> '' and lower(f.word) like '%' || q.w || '%' then 25 else 0 end)
      + coalesce((select count(*)::int * 6 from unnest(q.words) x where lower(f.word || ' ' || f.body) like '%' || x || '%'), 0)
      + (case when q.place <> '' and lower(f.place) like '%' || q.place || '%' then 30
              when q.place <> '' and lower(f.body) like '%' || q.place || '%' then 12 else 0 end)
      + (case when q.people <> '' and lower(coalesce(f.people, '')) like '%' || q.people || '%' then 20 else 0 end)
      as score
    from found f, q
  )
  select s.kind, s.id, s.word, s.body, s.place, coalesce(s.people, ''), s.visibility, s.created_at, s.score
  from scored s, q
  where (s.score > 0 or (q.w = '' and cardinality(q.words) = 0 and q.place = '' and q.people = ''))
    and (p_after is null or s.created_at >= p_after)
    and (p_before is null or s.created_at < p_before)
    and (coalesce(p_visibility, '') = '' or s.visibility = lower(trim(p_visibility)))
    -- With a place asked for, things somewhere else drop out unless they match strongly otherwise.
    and (q.place = '' or lower(s.place) like '%' || q.place || '%' or lower(s.body) like '%' || q.place || '%' or s.place = '' or s.score >= 100)
  order by s.score desc, s.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;
grant execute on function stardust_search(text, text, text, text, timestamptz, timestamptz, text, int) to anon, authenticated;

-- 4. Match: shared words, plus the same place, rank higher ------------------------

drop function if exists profile_matches(text, text, text, text, int);
create or replace function profile_matches(
  p_kind text,
  p_query text default '',
  p_relationship text default '',
  p_place text default '',
  p_limit int default 30
)
returns table (id uuid, kind text, side text, word text, body text, place text, people text, owner_name text,
               details jsonb, created_at timestamptz, shared text[])
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_mine profile_entries%rowtype;
  v_words text[];
  v_sides text[];
begin
  if v_me is null then raise exception 'Log in to match.'; end if;
  if p_kind not in ('person', 'idea', 'job', 'resource') then raise exception 'Match person, idea, job, or resource.'; end if;

  -- Your words: what you asked, plus your own entries of this kind.
  select stardust_words(coalesce(p_query, '') || ' ' || coalesce(string_agg(e.word || ' ' || e.body, ' '), ''))
    into v_words
  from profile_entries e
  where e.owner_user_id = v_me and e.kind = p_kind and not e.paused
    and (p_kind <> 'person' or coalesce(p_relationship, '') = '' or e.details ->> 'relationship' = p_relationship);

  -- Offers meet seeks. With no entries of your own, both sides show.
  select array_agg(distinct case when e.side = 'offer' then 'seek' else 'offer' end) into v_sides
  from profile_entries e where e.owner_user_id = v_me and e.kind = p_kind and not e.paused;
  if p_kind = 'person' or v_sides is null then v_sides := array['offer', 'seek']; end if;

  if p_kind = 'person' and p_relationship = 'romance' then
    if not is_adult(v_me) then raise exception 'Romance is 18 and older. Confirm your age first.'; end if;
    select * into v_mine from profile_entries e
    where e.owner_user_id = v_me and e.kind = 'person' and e.details ->> 'relationship' = 'romance'
      and not e.paused and e.hidden_at is null
    order by e.updated_at desc limit 1;
    if not found then raise exception 'Put up your own romance entry first. You see others while yours is up.'; end if;
  end if;

  return query
  select e.id, e.kind, e.side, e.word, e.body, e.place, e.people, e.owner_name, e.details, e.created_at,
         array(select unnest(stardust_words(e.word || ' ' || e.body)) intersect select unnest(v_words)) as shared
  from profile_entries e
  where e.kind = p_kind
    and e.owner_user_id <> v_me
    and e.visibility = 'public' and e.hidden_at is null and not e.paused
    and e.side = any (v_sides)
    and not is_blocked_between(v_me, e.owner_user_id)
    and (coalesce(p_place, '') = '' or e.place ilike '%' || trim(p_place) || '%')
    and (p_kind <> 'person' or coalesce(p_relationship, '') = '' or e.details ->> 'relationship' = p_relationship)
    -- Romance: only when both of you fit what the other is open to.
    and (
      coalesce(e.details ->> 'relationship', '') <> 'romance'
      or (
        p_relationship = 'romance'
        and (e.details ->> 'age')::int between (v_mine.details ->> 'age_min')::int and (v_mine.details ->> 'age_max')::int
        and (v_mine.details ->> 'age')::int between (e.details ->> 'age_min')::int and (e.details ->> 'age_max')::int
        and (v_mine.details ->> 'meet' = 'everyone'
             or (v_mine.details ->> 'meet' = 'women' and e.details ->> 'iam' = 'woman')
             or (v_mine.details ->> 'meet' = 'men' and e.details ->> 'iam' = 'man'))
        and (e.details ->> 'meet' = 'everyone'
             or (e.details ->> 'meet' = 'women' and v_mine.details ->> 'iam' = 'woman')
             or (e.details ->> 'meet' = 'men' and v_mine.details ->> 'iam' = 'man'))
      )
    )
  -- Shared words first, then the same place as theirs or as asked.
  order by cardinality(array(select unnest(stardust_words(e.word || ' ' || e.body)) intersect select unnest(v_words)))
           + (case when e.place <> '' and (
                (coalesce(p_place, '') <> '' and e.place ilike '%' || trim(p_place) || '%')
                or exists (select 1 from profile_entries m where m.owner_user_id = v_me and m.kind = p_kind and m.place <> '' and lower(m.place) = lower(e.place))
              ) then 3 else 0 end) desc,
           e.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;
grant execute on function profile_matches(text, text, text, text, int) to authenticated;
