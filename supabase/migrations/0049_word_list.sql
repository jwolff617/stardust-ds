-- Today's Word List (2026-11-23).
--
-- One list per spark, shown at the top left of Stardust. Sage makes it
-- ("new word list"), deletes it ("delete word list"; it never deletes
-- itself), and adds or removes words ("add to word list hope", "remove
-- from word list hope"). Each word remembers what it is (a note, an idea,
-- a dictionary noun...) so clicking it opens that word to edit.
--
-- Also: the app's own words (Word List, Contact, Inbox, Things...) join the
-- Stardust dictionary, and search tells nouns from verbs.

create table if not exists word_lists (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table word_lists enable row level security;
drop policy if exists "sparks keep their own word list" on word_lists;
create policy "sparks keep their own word list" on word_lists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists word_list_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references word_lists(user_id) on delete cascade,
  word text not null check (length(trim(word)) between 1 and 120),
  -- note, journal, person, idea, job, resource, organization, noun, verb, word, new
  kind text not null default 'new' check (length(kind) <= 20),
  ref_id uuid,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists word_list_words_one_each on word_list_words (user_id, lower(word));
alter table word_list_words enable row level security;
drop policy if exists "sparks keep their own list words" on word_list_words;
create policy "sparks keep their own list words" on word_list_words for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A list holds 100 words at most.
create or replace function word_list_words_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from word_list_words where user_id = new.user_id) >= 100 then
    raise exception 'Your word list holds 100 words. Remove one first.';
  end if;
  return new;
end;
$$;
drop trigger if exists word_list_words_cap on word_list_words;
create trigger word_list_words_cap before insert on word_list_words
  for each row execute function word_list_words_cap();

-- The app's words, in the Stardust dictionary.
insert into terms (name) values
  ('Word List'), ('Things'), ('Contact'), ('Share'), ('Delete'), ('Remove'), ('Inbox'), ('Settings')
on conflict (name) do nothing;

insert into definitions (term_id, dictionary_id, body, part_of_speech)
select t.id, d.id, v.body, v.pos
from (values
  ('Word List', 'Today''s words, kept at the top left of Stardust. Make one, add and remove words, delete it when the day is done. One at a time.', 'noun'),
  ('Things', 'What you do Stardust with: idea, org, profile, resource, inbox, settings, group, note, journal.', 'noun'),
  ('Contact', 'Reach another spark: say hello about something they wrote.', 'verb'),
  ('Share', 'Change who can see a word: private, group, or public.', 'verb'),
  ('Delete', 'Erase a word for good.', 'verb'),
  ('Remove', 'Take a word off a list, or a dictionary out of yours, without erasing it.', 'verb'),
  ('Inbox', 'Your private messages: hellos about your words and the ones you started.', 'noun'),
  ('Settings', 'Your private info, light or dark, and hotkeys.', 'noun')
) as v(name, body, pos)
join terms t on t.name = v.name
join dictionaries d on d.address = 'stardust'
on conflict (term_id, dictionary_id) do update set body = excluded.body, part_of_speech = excluded.part_of_speech;

-- Search: dictionary words say whether they're a noun or a verb.
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
    select (case when def.part_of_speech in ('noun', 'verb') then def.part_of_speech else 'word' end)::text as kind, def.id, t.name as word, def.body, ''::text as place, ''::text as people,
           'public'::text as visibility, def.created_at
    from definitions def
    join terms t on t.id = def.term_id
    join dictionaries d on d.id = def.dictionary_id
    where d.status = 'approved' and d.scope = 'shared' and d.kind <> 'instance'

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
    -- Profile entries: people, ideas, jobs, resources
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
