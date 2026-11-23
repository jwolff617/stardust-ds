-- One-page Stardust: Place and People on what you write, and one search
-- across everything a spark is allowed to see.
--
--   Word        a dictionary term, or the title of a listing, profile, org
--   Body        every word you give has to appear somewhere in it
--   Place       a town, neighborhood, region, country (matched as text)
--   People      a spark's name
--   Time        created after / before (the app turns "week" or a date
--               into these two)
--   Visibility  private, group, or public
--
-- The search runs as the caller (security invoker), so every table's own
-- read rules still decide what comes back. Nobody finds anyone's private
-- words. Signed out, that leaves the dictionaries.

-- 1. Place and People on notes and journal entries -------------------------

alter table notes
  add column if not exists place text not null default '' check (length(place) <= 120),
  add column if not exists people text not null default '' check (length(people) <= 300);

alter table journal_entries
  add column if not exists place text not null default '' check (length(place) <= 120),
  add column if not exists people text not null default '' check (length(people) <= 300);

-- 2. The search ------------------------------------------------------------

-- True when every word of p_query shows up in p_text. Empty matches all.
create or replace function stardust_has_words(p_text text, p_query text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_query, '') = ''
    or not exists (
      select 1 from regexp_split_to_table(trim(p_query), '\s+') w
      where w <> '' and coalesce(p_text, '') not ilike '%' || w || '%'
    );
$$;

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
returns table (
  kind text,
  id uuid,
  word text,
  body text,
  place text,
  people text,
  visibility text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with found as (
    -- Dictionary words (Stardust and every other shared dictionary)
    select 'word'::text as kind, def.id, t.name as word, def.body, ''::text as place, ''::text as people,
           'public'::text as visibility, def.created_at
    from definitions def
    join terms t on t.id = def.term_id
    join dictionaries d on d.id = def.dictionary_id
    where d.status = 'approved' and d.scope = 'shared' and d.kind <> 'instance'

    union all
    -- Night Notes
    select 'note', n.id, left(regexp_replace(n.body, '\s+', ' ', 'g'), 60), n.body, n.place,
           nullif(concat_ws(', ', nullif(n.people, ''), p.display_name), ''),
           case when d.scope = 'group' then 'group' else n.visibility end, n.created_at
    from notes n
    join dictionaries d on d.id = n.dictionary_id
    left join profiles p on p.id = n.owner_user_id

    union all
    -- Journal entries
    select 'journal', j.id, d.name, j.body, j.place,
           nullif(concat_ws(', ', nullif(j.people, ''), p.display_name), ''),
           case when d.scope = 'group' then 'group' else 'private' end, j.created_at
    from journal_entries j
    join dictionaries d on d.id = j.dictionary_id
    left join profiles p on p.id = j.owner_user_id

    union all
    -- Listings: ideas, jobs, things for sale or free
    select 'listing', d.id, d.name, coalesce((select string_agg(v.value, ' · ') from jsonb_each_text(coalesce(d.page, '{}'::jsonb)) v), ''),
           coalesce(d.page ->> 'neighborhood', d.page ->> 'Neighborhood', ''), d.by_name, 'public', d.created_at
    from dictionaries d
    where d.display_kind = 'listing' and d.hidden_at is null and d.closed_at is null
      and (d.expires_at is null or d.expires_at > now())

    union all
    -- Public profiles: a spark's public fields
    select 'profile', pr.id, coalesce(nullif(pr.display_name, ''), 'A spark'),
           string_agg(f.name || ': ' || f.value, ' · ' order by f.position), '', pr.display_name, 'public', min(f.created_at)
    from profile_fields f
    join profiles pr on pr.id = f.owner_user_id
    where f.visibility = 'public' and f.value <> ''
    group by pr.id, pr.display_name

    union all
    -- Organizations: businesses, nonprofits, governments
    select 'organization', o.id, o.name, concat_ws(' · ', o.kind, nullif(o.about, '')), o.neighborhood, '', 'public', o.created_at
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
    -- An exact word first, then words that start with it, then newest.
    (lower(f.word) = lower(trim(coalesce(p_word, '')))) desc,
    (f.word ilike trim(coalesce(p_word, '')) || '%') desc,
    f.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

grant execute on function stardust_has_words(text, text) to anon, authenticated;
grant execute on function stardust_search(text, text, text, text, timestamptz, timestamptz, text, int) to anon, authenticated;
