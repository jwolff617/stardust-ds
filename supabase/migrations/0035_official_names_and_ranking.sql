-- Names are free: two dictionaries can share a name and compete. The one
-- more people add to their Library ranks higher. One exception: an
-- Official dictionary's name can't be copied by someone else.

create or replace function guard_official_names()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and (tg_op = 'INSERT' or new.name is distinct from old.name)
     and exists (
       select 1 from dictionaries o
       where o.page_status = 'official'
         and o.id <> new.id
         and o.owner_user_id is distinct from new.owner_user_id
         and lower(trim(o.name)) = lower(trim(new.name))
     ) then
    raise exception '"%" belongs to an Official dictionary. Try another name.', new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists dictionaries_official_names on dictionaries;
create trigger dictionaries_official_names
  before insert or update of name on dictionaries
  for each row execute function guard_official_names();

-- Import search, ranked: name matches, then Official, then how many
-- people added it to their Library, then newest. Never by payment.
create index if not exists user_dictionaries_opted_idx on user_dictionaries (dictionary_id) where opted_in;

-- How many people have a dictionary in their Library. A count only, never
-- who.
create or replace function library_count(p_id uuid)
returns bigint
language sql
stable
security definer set search_path = public
as $$
  select count(*) from user_dictionaries where dictionary_id = p_id and opted_in;
$$;

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
    select distinct d.id, d.name, d.description, d.page, d.page_status, d.owner_user_id, d.created_at
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
    coalesce(m.page_status = 'official', false) desc,
    library_count(m.id) desc,
    m.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function library_count(uuid) to anon, authenticated;
grant execute on function search_imports(text[], text, uuid, int, int) to anon, authenticated;
