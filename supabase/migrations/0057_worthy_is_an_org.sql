-- Worthy is an organization, not an idea (2026-11-23). Peacemaker runs it.
-- Its text (the idea journal's entries, oldest first, or the idea card) becomes
-- the org's body. The idea journal is cut (kept until the 2026-12-22 cleanup)
-- and the idea match line leaves the profile. Word lists, visits, and stars
-- follow it to the org.

do $$
declare
  v_owner uuid;
  v_idea uuid;
  v_entry uuid;
  v_body text;
  v_org uuid;
begin
  select id into v_owner from profiles where lower(trim(display_name)) = 'peacemaker' limit 1;
  if v_owner is null then
    raise exception 'No spark named Peacemaker. Set your name in Settings first, then run this again.';
  end if;

  if exists (select 1 from organizations o join organization_members m on m.organization_id = o.id
             where m.user_id = v_owner and m.role = 'admin' and lower(o.name) = 'worthy') then
    raise notice 'Worthy is already an organization.';
    return;
  end if;

  select id into v_idea from dictionaries
  where owner_user_id = v_owner and address like 'idea-%' and lower(name) = 'worthy' and status = 'approved'
  limit 1;
  select id into v_entry from profile_entries
  where owner_user_id = v_owner and kind = 'idea' and lower(word) = 'worthy'
  limit 1;

  select string_agg(body, E'\n\n' order by created_at) into v_body
  from journal_entries where dictionary_id = v_idea and trim(body) <> '';
  if coalesce(trim(v_body), '') = '' then
    select body into v_body from profile_entries where id = v_entry;
  end if;

  insert into organizations (slug, name, kind, about, visibility, status)
  values ('worthy-' || substr(gen_random_uuid()::text, 1, 6), 'Worthy', 'other',
          left(coalesce(nullif(trim(v_body), ''), 'Saving half of your winnings.'), 5000), 'public', 'unverified')
  returning id into v_org;
  insert into organization_members (organization_id, user_id, role) values (v_org, v_owner, 'admin');

  update word_list_words set kind = 'organization', ref_id = v_org
  where lower(word) = 'worthy' and (ref_id = v_idea or ref_id = v_entry);

  update noun_visits set kind = 'organization', ref_id = v_org
  where ref_id = v_idea and not exists (
    select 1 from noun_visits x where x.user_id = noun_visits.user_id and x.kind = 'organization' and x.ref_id = v_org);

  if v_idea is not null then
    update dictionaries set status = 'rejected' where id = v_idea;
  end if;
  if v_entry is not null then
    delete from profile_entries where id = v_entry;
  end if;
end $$;
