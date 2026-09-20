-- Notes are a single content field (body) with no title. Display order/identity
-- comes from position (rendered as a note's number), not a title.

drop index if exists notes_active_title_idx;

alter table notes drop column if exists title;
