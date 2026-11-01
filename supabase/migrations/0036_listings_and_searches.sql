-- Dictionary types: listings and searches.
--
-- A search (Idea Index, Marketplace, anyone's market village) has a shape
-- (its fields), a noun ("idea", "listing"), and the labels it imports.
-- Its "+ New idea" button makes a listing: a small dictionary the maker
-- names, in the search's shape, already carrying the search's labels.
--
-- Listings are public to signed-in sparks right away. Reports hide bad
-- ones (next session); moderators can delete any of them now.

alter table dictionaries
  add column if not exists noun text check (noun is null or length(noun) between 1 and 30),
  add column if not exists by_name text not null default '';

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                            'notepad', 'contacts', 'birthdays', 'wolffie_games',
                            'marketplace', 'jobs', 'ideas', 'manifesto', 'idea_house', 'custom', 'page',
                            'listing', 'search'));

-- Listings and searches are readable by any signed-in spark.
drop policy if exists "listings and searches are readable by sparks" on dictionaries;
create policy "listings and searches are readable by sparks"
  on dictionaries for select
  using (display_kind in ('listing', 'search') and status = 'approved' and auth.uid() is not null);

drop policy if exists "labels on listings and searches are readable" on dictionary_labels;
create policy "labels on listings and searches are readable"
  on dictionary_labels for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from dictionaries d
      where d.id = dictionary_labels.dictionary_id
        and d.display_kind in ('listing', 'search')
        and d.status = 'approved'
    )
  );

-- Checks a shape: 1 to 8 fields, each with a key, a label, and a type.
create or replace function check_shape(p_fields jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_field jsonb;
begin
  if jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) not between 1 and 8 then
    raise exception 'A shape needs 1 to 8 fields.';
  end if;
  for v_field in select * from jsonb_array_elements(p_fields) loop
    if coalesce(v_field ->> 'key', '') !~ '^[a-z][a-z0-9_]{0,29}$'
       or coalesce(length(v_field ->> 'label'), 0) not between 1 and 40
       or coalesce(v_field ->> 'type', '') not in ('text', 'longtext', 'number', 'date') then
      raise exception 'Each field needs a short name and a type: text, longtext, number, or date.';
    end if;
  end loop;
end;
$$;

-- Keeps only the shape's keys, as short strings.
create or replace function shape_values(p_fields jsonb, p_values jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(f ->> 'key', left(trim(p_values ->> (f ->> 'key')), case when f ->> 'type' = 'longtext' then 5000 else 300 end)), '{}'::jsonb)
  from jsonb_array_elements(p_fields) f
  where coalesce(trim(p_values ->> (f ->> 'key')), '') <> '';
$$;

-- Clean labels: lowercase, no #, no earned labels, up to 10.
create or replace function clean_labels(p_labels text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(l), '{}') from (
    select distinct l from (
      select left(lower(regexp_replace(trim(regexp_replace(x, '^#+', '')), '\s+', ' ', 'g')), 40) as l
      from unnest(coalesce(p_labels, '{}')) x
    ) s
    where l <> '' and l not in ('official', 'verified', 'government', 'nonprofit')
    limit 10
  ) t;
$$;

-- Makes a listing from a search: named by the maker, in the search's shape,
-- carrying the search's labels plus any the maker adds. It stands on its
-- own: deleting the search never deletes anyone's listings.
create or replace function create_listing(p_search uuid, p_name text, p_values jsonb, p_labels text[] default '{}')
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_search dictionaries%rowtype;
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_id uuid;
  v_label text;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give it a name.'; end if;
  select * into v_search from dictionaries where id = p_search;
  if not found or v_search.noun is null or v_search.fields is null then
    raise exception 'That dictionary doesn''t make listings.';
  end if;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'listing'
      and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s 20 today. Try again tomorrow.';
  end if;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'listing') >= 200 then
    raise exception 'You have 200 listings. Delete one to make another.';
  end if;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind, fields, page, by_name)
  values ('listing-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance', 'shared', 'public', 'approved',
          false, false, auth.uid(), 'listing', v_search.fields, shape_values(v_search.fields, p_values),
          coalesce((select display_name from profiles where id = auth.uid()), ''))
  returning id into v_id;

  foreach v_label in array clean_labels(v_search.shows || coalesce(p_labels, '{}')) loop
    insert into dictionary_labels (dictionary_id, label) values (v_id, v_label) on conflict do nothing;
  end loop;
  return v_id;
end;
$$;

-- Saves a listing's name and words. The maker only.
create or replace function save_listing(p_id uuid, p_name text, p_values jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update dictionaries
  set name = coalesce(left(nullif(trim(p_name), ''), 80), name),
      page = shape_values(fields, p_values)
  where id = p_id and owner_user_id = auth.uid() and display_kind = 'listing';
  if not found then raise exception 'That listing isn''t yours.'; end if;
end;
$$;

create or replace function delete_listing(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from dictionaries where id = p_id and owner_user_id = auth.uid() and display_kind = 'listing';
  if not found then raise exception 'That listing isn''t yours.'; end if;
end;
$$;

-- Makes a search: a name, what it makes, its shape, and the labels it
-- imports. The maker owns it and it's turned on for them.
create or replace function create_search(p_name text, p_description text, p_noun text, p_fields jsonb, p_imports text[])
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_noun text := left(nullif(lower(trim(p_noun)), ''), 30);
  v_imports text[] := clean_labels(p_imports);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give it a name.'; end if;
  if v_noun is null then raise exception 'Say what it makes, like "idea" or "listing".'; end if;
  if cardinality(v_imports) = 0 then raise exception 'Pick at least one label to search.'; end if;
  perform check_shape(p_fields);
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'search') >= 25 then
    raise exception 'You have 25 searches. Delete one to make another.';
  end if;

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, display_kind, fields, noun, shows)
  values ('search-' || substr(gen_random_uuid()::text, 1, 12), v_name, left(nullif(trim(p_description), ''), 300),
          'instance', 'shared', 'public', 'approved', false, false, auth.uid(), 'search', p_fields, v_noun, v_imports)
  returning id into v_id;

  insert into dictionary_labels (dictionary_id, label)
  select v_id, l from unnest(v_imports) l on conflict do nothing;
  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;

-- The owner (or a moderator) changes what a dictionary makes: its noun
-- and shape. Listings already made keep the shape they were made with.
create or replace function set_shape(p_id uuid, p_noun text, p_fields jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_noun text := left(nullif(lower(trim(p_noun)), ''), 30);
begin
  if v_noun is null then raise exception 'Say what it makes, like "idea" or "listing".'; end if;
  perform check_shape(p_fields);
  update dictionaries set noun = v_noun, fields = p_fields
  where id = p_id and display_kind <> 'listing' and (owner_user_id = auth.uid() or is_moderator());
  if not found then raise exception 'That dictionary isn''t yours.'; end if;
end;
$$;

revoke execute on function create_listing(uuid, text, jsonb, text[]), save_listing(uuid, text, jsonb), delete_listing(uuid),
  create_search(text, text, text, jsonb, text[]), set_shape(uuid, text, jsonb) from public, anon;
grant execute on function create_listing(uuid, text, jsonb, text[]), save_listing(uuid, text, jsonb), delete_listing(uuid),
  create_search(text, text, text, jsonb, text[]), set_shape(uuid, text, jsonb) to authenticated;

-- What the boards make.
update dictionaries set noun = 'idea', fields = '[
  {"key": "problem", "label": "The problem", "type": "longtext"},
  {"key": "first_step", "label": "The first step", "type": "longtext"},
  {"key": "looking_for", "label": "Who you''re looking for", "type": "text"},
  {"key": "contact", "label": "How to reach you", "type": "text"}
]'::jsonb where address = 'idea-index-ds';

update dictionaries set noun = 'listing', fields = '[
  {"key": "price", "label": "Price", "type": "text"},
  {"key": "neighborhood", "label": "Neighborhood", "type": "text"},
  {"key": "details", "label": "Details", "type": "longtext"},
  {"key": "contact", "label": "How to reach you", "type": "text"}
]'::jsonb where address = 'marketplace-ds';

update dictionaries set noun = 'job', fields = '[
  {"key": "pay", "label": "Pay", "type": "text"},
  {"key": "neighborhood", "label": "Neighborhood", "type": "text"},
  {"key": "details", "label": "What the work is", "type": "longtext"},
  {"key": "apply", "label": "How to apply", "type": "text"}
]'::jsonb where address = 'job-match-ds';

-- Import search gains a Mine filter: only what you made.
drop function if exists search_imports(text[], text, uuid, int, int);
create or replace function search_imports(
  p_labels text[],
  p_query text default '',
  p_except uuid default null,
  p_limit int default 12,
  p_offset int default 0,
  p_mine boolean default false
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
      and (not p_mine or d.owner_user_id = auth.uid())
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

grant execute on function search_imports(text[], text, uuid, int, int, boolean) to anon, authenticated;
