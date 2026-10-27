-- How each person has arranged the app: Module 2's checked dictionaries,
-- tabs, view, and feed order, and whether Module 1's store is open. Saved
-- with the account so it follows you to every device. The app also keeps a
-- copy in the browser and works from that alone if this column is missing.

alter table profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
