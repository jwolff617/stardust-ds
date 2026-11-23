-- Worthy is an idea, not a dictionary word (2026-11-23). It moves to a
-- public idea on Peacemaker's profile, with the dictionary's text as its
-- body, and leaves the Stardust and Core dictionaries.

do $$
declare
  v_owner uuid;
  v_body text;
begin
  select id into v_owner from profiles where lower(trim(display_name)) = 'peacemaker' limit 1;
  if v_owner is null then
    raise exception 'No spark named Peacemaker. Set your name in Settings first, then run this again.';
  end if;

  select d.body into v_body
  from definitions d join terms t on t.id = d.term_id
  join dictionaries x on x.id = d.dictionary_id
  where t.name = 'Worthy' and x.address = 'stardust';

  if not exists (select 1 from profile_entries where owner_user_id = v_owner and kind = 'idea' and lower(word) = 'worthy') then
    insert into profile_entries (owner_user_id, kind, side, word, body, visibility)
    values (v_owner, 'idea', 'offer', 'Worthy', coalesce(v_body, 'Saving half of your winnings.'), 'public');
  end if;

  delete from definitions
  where term_id = (select id from terms where name = 'Worthy')
    and dictionary_id in (select id from dictionaries where address in ('stardust', 'core'));

  -- Word lists pointing at the old definition now point at the idea.
  update word_list_words w set kind = 'idea', ref_id = e.id
  from profile_entries e
  where lower(w.word) = 'worthy' and w.kind in ('noun', 'verb', 'word')
    and e.owner_user_id = v_owner and e.kind = 'idea' and lower(e.word) = 'worthy';
end $$;
