-- Accounts DS: an entry's quantity can be a number or a word ("3", "a lot",
-- "half"). Nothing adds them up anymore. The column keeps its old name,
-- amount; the app calls it Quantity.

alter table account_entries drop constraint if exists account_entries_check;

alter table account_entries
  alter column amount type text using trim_scale(amount)::text;

alter table account_entries
  add constraint account_entries_check
    check (amount is not null and length(trim(amount)) between 1 and 60
           or (note is not null and length(trim(note)) > 0)),
  add constraint account_entries_amount_length check (amount is null or length(amount) <= 60);

update definitions
set body = 'One dated line in an account: a quantity (a number or a word), a note, or both.'
where dictionary_id = (select id from dictionaries where address = 'accounts-ds')
  and term_id = (select id from terms where name = 'Entry');

update definitions
set body = 'What an account holds: its entries, newest first.'
where dictionary_id = (select id from dictionaries where address = 'accounts-ds')
  and term_id = (select id from terms where name = 'Balance');
