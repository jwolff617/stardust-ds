-- Searching a dictionary's imports. Every search dictionary (Idea Index,
-- Marketplace, someone's Market Village) uses this one function: the
-- dictionaries carrying any of the labels, matched against a few words, a
-- page at a time. Nothing is loaded all at once, so it stays fast with tens
-- of thousands of dictionaries.
--
-- Runs as the caller, so RLS still decides what each person can see.
-- Words match the name, description, labels, a page's text, a built
-- dictionary's entries, and its definitions. Every word must match
-- somewhere. Name matches rank first, then newest.

create index if not exists dictionary_labels_label_idx on dictionary_labels (label);

create or replace function search_imports(
  p_labels text[],
  p_query text default '',
  p_except uuid default null,
  p_limit int default 12,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  description text,
  labels text[],
  owner_user_id uuid,
  total bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with words as (
    select w from unnest(regexp_split_to_array(lower(trim(coalesce(p_query, ''))), '\s+')) as w
    where w <> ''
  ),
  pool as (
    select distinct d.id, d.name, d.description, d.page, d.owner_user_id, d.created_at
    from dictionary_labels l
    join dictionaries d on d.id = l.dictionary_id
    where l.label = any (p_labels)
      and (p_except is null or d.id <> p_except)
  ),
  scored as (
    select p.*,
      (select array_agg(x.label order by x.label) from dictionary_labels x where x.dictionary_id = p.id) as all_labels
    from pool p
  ),
  matched as (
    select s.*
    from scored s
    where not exists (
      select 1 from words
      where not (
        lower(s.name) like '%' || w || '%'
        or lower(coalesce(s.description, '')) like '%' || w || '%'
        or exists (select 1 from unnest(s.all_labels) lab where lab like '%' || w || '%')
        or lower(coalesce(s.page::text, '')) like '%' || w || '%'
        or exists (select 1 from custom_entries e where e.dictionary_id = s.id and lower(e.data::text) like '%' || w || '%')
        or exists (
          select 1 from definitions df join terms t on t.id = df.term_id
          where df.dictionary_id = s.id and (lower(t.name) like '%' || w || '%' or lower(df.body) like '%' || w || '%')
        )
      )
    )
  )
  select m.id, m.name, m.description, coalesce(m.all_labels, '{}'), m.owner_user_id, count(*) over ()
  from matched m
  order by
    (select count(*) from words where lower(m.name) like '%' || w || '%') desc,
    m.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function search_imports(text[], text, uuid, int, int) to anon, authenticated;
