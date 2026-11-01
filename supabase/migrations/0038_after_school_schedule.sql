-- After School: a daily schedule, the third page. Rows of time, activity,
-- and notes, in the order the group sets. Shared by everyone in the group.

create table if not exists after_school_schedule (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  position integer not null default 0,
  time text not null default '' check (length(time) <= 40),
  activity text not null default '' check (length(activity) <= 200),
  notes text not null default '' check (length(notes) <= 2000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists after_school_schedule_idx on after_school_schedule (dictionary_id, position);

alter table after_school_schedule enable row level security;

drop policy if exists "group members manage the daily schedule" on after_school_schedule;
create policy "group members manage the daily schedule"
  on after_school_schedule for all
  to authenticated
  using (is_dictionary_member(dictionary_id))
  with check (is_dictionary_member(dictionary_id));
