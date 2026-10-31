-- Business Pages: a template anyone can copy as many times as they like,
-- naming each copy. Each page is a dictionary that works like an official
-- website: a tagline, what it is, highlights, what's coming, and how to
-- reach you. A page is only yours until you Apply for Official; a
-- moderator approves it, and then it shows in everyone's Library with an
-- Official badge. Moderators (site-wide stewards) can also delete any
-- dictionary from the Library.
--
-- Seeds Sage's four project pages, applied and waiting for approval.

alter table dictionaries
  add column if not exists page jsonb check (page is null or jsonb_typeof(page) = 'object'),
  add column if not exists page_status text check (page_status in ('draft', 'applied', 'official'));

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                            'notepad', 'contacts', 'birthdays', 'wolffie_games',
                            'marketplace', 'jobs', 'ideas', 'manifesto', 'idea_house', 'custom', 'page'));

alter table dictionaries
  drop constraint if exists dictionaries_instance_display_kind_check,
  add constraint dictionaries_instance_display_kind_check
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy', 'after_school', 'lockers', 'lockers_admin',
                                     'notepad', 'contacts', 'birthdays', 'wolffie_games',
                                     'marketplace', 'jobs', 'ideas', 'manifesto', 'idea_house', 'page'));

-- A moderator is a steward for the whole site (no board named).
create or replace function is_moderator()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from stewards where user_id = auth.uid() and dictionary_id is null);
$$;

grant execute on function is_moderator() to authenticated;

-- Official pages are public. Your own pages, and pages waiting for a
-- moderator, are visible to you and to moderators.
drop policy if exists "pages are readable when official" on dictionaries;
create policy "pages are readable when official"
  on dictionaries for select
  using (
    display_kind = 'page'
    and (page_status = 'official' or owner_user_id = auth.uid() or (page_status = 'applied' and is_moderator()))
  );

drop policy if exists "labels on official pages are readable" on dictionary_labels;
create policy "labels on official pages are readable"
  on dictionary_labels for select
  using (
    exists (
      select 1 from dictionaries d
      where d.id = dictionary_labels.dictionary_id
        and d.display_kind = 'page'
        and (d.page_status = 'official' or d.owner_user_id = auth.uid() or is_moderator())
    )
  );

-- The template.
insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in, instance_display_kind)
values (
  'business-page',
  'Business Page',
  'A page for your business, project, or nonprofit: what it is, what''s coming, and how to reach you. Make as many as you like, and apply for Official to show it to everyone.',
  'instance_template', 'shared', 'public', 'approved', false, false, 'page'
)
on conflict (address) do update set description = excluded.description, instance_display_kind = excluded.instance_display_kind;

insert into dictionary_labels (dictionary_id, label)
select id, v.label from dictionaries
cross join (values ('business'), ('page'), ('project'), ('nonprofit'), ('official')) as v(label)
where address = 'business-page'
on conflict do nothing;

-- Makes a new page from the template and turns it on.
create or replace function create_page(p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_template uuid;
  v_id uuid;
  v_name text := left(nullif(trim(p_name), ''), 80);
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if v_name is null then raise exception 'Give your page a name.'; end if;
  if (select count(*) from dictionaries where owner_user_id = auth.uid() and display_kind = 'page') >= 25 then
    raise exception 'You have 25 pages. Delete one to make another.';
  end if;
  select id into v_template from dictionaries where address = 'business-page';

  insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                            owner_user_id, template_id, display_kind, page, page_status)
  values ('page-' || substr(gen_random_uuid()::text, 1, 12), v_name, null, 'instance', 'shared', 'public', 'approved',
          false, false, auth.uid(), v_template, 'page', '{}'::jsonb, 'draft')
  returning id into v_id;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at) values (auth.uid(), v_id, true, now());
  return v_id;
end;
$$;

-- Saves a page's words. The owner only.
create or replace function save_page(p_id uuid, p_name text, p_description text, p_page jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if jsonb_typeof(p_page) <> 'object' or length(p_page::text) > 20000 then
    raise exception 'That page is too long.';
  end if;
  update dictionaries
  set name = coalesce(left(nullif(trim(p_name), ''), 80), name),
      description = left(nullif(trim(p_description), ''), 300),
      page = p_page
  where id = p_id and owner_user_id = auth.uid() and display_kind = 'page';
  if not found then raise exception 'That page isn''t yours.'; end if;
end;
$$;

-- The owner applies for Official; a moderator approves or sends it back.
create or replace function apply_official(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update dictionaries set page_status = 'applied'
  where id = p_id and owner_user_id = auth.uid() and display_kind = 'page' and page_status = 'draft';
  if not found then raise exception 'That page can''t apply right now.'; end if;
end;
$$;

create or replace function review_page(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Only a moderator can do that.'; end if;
  update dictionaries set page_status = case when p_approve then 'official' else 'draft' end
  where id = p_id and display_kind = 'page';
  if not found then raise exception 'Page not found.'; end if;
end;
$$;

-- A moderator deletes a dictionary from the Library for everyone, with
-- every copy of it. Core, Stardust, and locked dictionaries stay.
create or replace function moderator_delete_dictionary(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_row dictionaries%rowtype;
begin
  if not is_moderator() then raise exception 'Only a moderator can do that.'; end if;
  select * into v_row from dictionaries where id = p_id;
  if not found then raise exception 'Dictionary not found.'; end if;
  if v_row.locked or v_row.address in ('core', 'stardust') then
    raise exception '% can''t be deleted.', v_row.name;
  end if;
  delete from dictionaries where template_id = p_id;
  delete from dictionaries where id = p_id;
end;
$$;

revoke execute on function create_page(text), save_page(uuid, text, text, jsonb), apply_official(uuid),
  review_page(uuid, boolean), moderator_delete_dictionary(uuid) from public, anon;
grant execute on function create_page(text), save_page(uuid, text, text, jsonb), apply_official(uuid),
  review_page(uuid, boolean), moderator_delete_dictionary(uuid) to authenticated;

-- Sage's four project pages, applied for Official.
with owner as (select id from auth.users where email = 'jwolff617@gmail.com'),
template as (select id from dictionaries where address = 'business-page'),
pages (address, name, description, page) as (values
  ('page-wack', 'WACK', 'The Banned Book: the human experience, one word at a time.', jsonb_build_object(
    'tagline', 'THE BANNED BOOK. Turn on feeling.',
    'about', 'WACK: Turn On Feeling is an illustrated field guide that defines the human experience one word at a time, from Stardust to Union, with love as the common denominator. Each word gets a spread: a simple drawing, a definition, a line of math, and a WACK Lesson that dares you to put the book down and go live.',
    'highlights', E'39 words, from Stardust to Union\nA drawing, a definition, a line of math, and a lesson for each word\nRaw, funny, and spiritual\nFor anyone who got the rules and never got the reasons',
    'coming', 'The manuscript is finished. Queries go out to literary agents this November.',
    'contact', 'Sage Peace',
    'link', 'https://urbanwolfstudio.net/books')),
  ('page-playbound-city', 'Playbound City', 'A picture book about a city built for play.', jsonb_build_object(
    'tagline', 'A city where every road leads to play.',
    'about', 'Playbound City is a picture book about a town designed for kids: a road to the Stardust Library, a superblock where streets become playgrounds, a teen convention, and an Idea House where anyone''s idea can grow. It grew from Playbound, a 2023 City of Chicago grant finalist.',
    'highlights', E'Drawn by hand by Sage Peace\nThe road to the Stardust Library\nThe superblock, the teen convention, and the Idea House\nFrom Playbound, a 2023 City of Chicago grant finalist',
    'coming', 'Writing and drawing begin in December 2026.',
    'contact', 'Sage Peace',
    'link', 'https://urbanwolfstudio.net/books')),
  ('page-sage-peace-occasions', 'Sage Peace Occasions', 'Cards and t-shirts for love, forgiveness, and the moments that matter.', jsonb_build_object(
    'tagline', 'Words for the moments that matter.',
    'about', 'Sage Peace Occasions makes cards and t-shirts written from the Stardust Dictionary: cards for love, forgiveness, coming out, and the people who raised you. Honest words, said out loud.',
    'highlights', E'Cards for love, forgiveness, and coming out\nT-shirts with Stardust words\nEvery line comes from the Stardust Dictionary',
    'coming', 'The first cards and shirts are in development for the Urban Wolf Studio shop.',
    'contact', 'Sage Peace',
    'link', 'https://urbanwolfstudio.net/shop')),
  ('page-stardust-dictionary', 'Stardust Dictionary', 'The words of feeling, body, spirit, and soul.', jsonb_build_object(
    'tagline', 'Every word you feel, defined.',
    'about', 'The Stardust Dictionary defines the words of feeling, body, spirit, and soul, A to Z, each with a line of math. It is the source of every Sage Peace card and shirt, and the language Stardust DS and Sage AI speak.',
    'highlights', E'About 175 words, A to Z\nA line of math for each word\nThe source of Sage Peace cards and shirts\nThe language of Stardust DS',
    'coming', 'The first edition is being finished this November. The PDF will be free, with a paperback in the shop.',
    'contact', 'Sage Peace',
    'link', 'https://urbanwolfstudio.net/books'))
)
insert into dictionaries (address, name, description, kind, scope, visibility, status, locked, default_opt_in,
                          owner_user_id, template_id, display_kind, page, page_status)
select p.address, p.name, p.description, 'instance', 'shared', 'public', 'approved', false, false,
       owner.id, template.id, 'page', p.page, 'applied'
from pages p, owner, template
on conflict (address) do nothing;

insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
select d.owner_user_id, d.id, true, now()
from dictionaries d
where d.address in ('page-wack', 'page-playbound-city', 'page-sage-peace-occasions', 'page-stardust-dictionary')
on conflict (user_id, dictionary_id) do nothing;

insert into dictionary_labels (dictionary_id, label)
select d.id, v.label
from dictionaries d
join (values
  ('page-wack', 'book'), ('page-wack', 'wack'), ('page-wack', 'feeling'), ('page-wack', 'self-help'), ('page-wack', 'sage peace'),
  ('page-playbound-city', 'book'), ('page-playbound-city', 'kids'), ('page-playbound-city', 'picture book'), ('page-playbound-city', 'city'), ('page-playbound-city', 'play'),
  ('page-sage-peace-occasions', 'cards'), ('page-sage-peace-occasions', 't-shirts'), ('page-sage-peace-occasions', 'gifts'), ('page-sage-peace-occasions', 'love'), ('page-sage-peace-occasions', 'sage peace'),
  ('page-stardust-dictionary', 'book'), ('page-stardust-dictionary', 'dictionary'), ('page-stardust-dictionary', 'feeling'), ('page-stardust-dictionary', 'words'), ('page-stardust-dictionary', 'sage peace')
) as v(address, label) on v.address = d.address
on conflict do nothing;
