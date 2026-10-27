-- Worthy DS: a sixth principle, Heart. The best bet ideas come from the
-- heart: a unique perspective, something the books missed.

alter table bet_stories drop constraint if exists bet_stories_principles_check;
alter table bet_stories add constraint bet_stories_principles_check
  check (principles <@ array['unique', 'present', 'open_minded', 'fun', 'good_reason', 'heart']);
