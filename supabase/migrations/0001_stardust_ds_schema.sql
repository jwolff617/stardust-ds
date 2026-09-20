-- Stardust DS v1 schema.
--
-- Two kinds of dictionaries share the app-facing Term/Definition shape but
-- live in physically separate tables:
--   - shared vocabulary (Core, Stardust, topical/business dictionaries):
--     terms/definitions, one global row every user sees identically.
--   - personal/instance dictionaries (User Dictionary, Night DS): each
--     opted-in user gets their own private term space under the same
--     dictionary, so one user's notes/contact info can never collide with
--     or leak into another user's, or into the global vocabulary.

create extension if not exists "pgcrypto";

create table dictionaries (
  id uuid primary key default gen_random_uuid(),
  address text unique not null,
  name text not null,
  description text,
  kind text not null check (kind in ('core', 'stardust', 'topical', 'business', 'user_template', 'instance_template')),
  scope text not null check (scope in ('shared', 'personal')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  locked boolean not null default false,
  default_opt_in boolean not null default false,
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Shared vocabulary: the word/phrase itself, globally unique, dictionary-independent.
create table terms (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

-- One dictionary's meaning for a shared term.
create table definitions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id) on delete cascade,
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  body text not null,
  part_of_speech text not null check (part_of_speech in ('verb', 'noun', 'more')),
  -- Opt-in position score (Reality/Digital/Spiritual, 0-100). Most
  -- dictionaries never set these; Stardust is the first to use them.
  position_x smallint check (position_x between 0 and 100),
  position_y smallint check (position_y between 0 and 100),
  position_z smallint check (position_z between 0 and 100),
  created_at timestamptz not null default now(),
  unique (term_id, dictionary_id)
);

-- Personal/instance data: same shape, scoped to one owner under one
-- personal-scope dictionary (e.g. Night DS notes, User Dictionary fields).
create table personal_terms (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Set by Night DS's "Note Archive" verb: moved out of active view
  -- without deleting the row.
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (dictionary_id, owner_user_id, name)
);

create table personal_definitions (
  id uuid primary key default gen_random_uuid(),
  personal_term_id uuid not null references personal_terms(id) on delete cascade,
  body text not null,
  part_of_speech text not null check (part_of_speech in ('verb', 'noun', 'more')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which dictionaries a user currently has active.
create table user_dictionaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  opted_in boolean not null default true,
  opted_in_at timestamptz not null default now(),
  primary key (user_id, dictionary_id)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);

create index definitions_dictionary_id_idx on definitions(dictionary_id);
create index definitions_term_id_idx on definitions(term_id);
create index personal_terms_dictionary_owner_idx on personal_terms(dictionary_id, owner_user_id);
create index personal_definitions_personal_term_id_idx on personal_definitions(personal_term_id);
create index user_dictionaries_user_id_idx on user_dictionaries(user_id);
create index conversations_user_id_idx on conversations(user_id);
create index messages_conversation_id_idx on messages(conversation_id);

-- New user: create their profile, auto-opt into Core (locked on) + Stardust
-- (on, removable). Runs as the function owner (postgres), bypassing RLS.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');

  insert into user_dictionaries (user_id, dictionary_id, opted_in)
  select new.id, id, true
  from dictionaries
  where address in ('core', 'stardust');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Row Level Security
alter table dictionaries enable row level security;
alter table terms enable row level security;
alter table definitions enable row level security;
alter table personal_terms enable row level security;
alter table personal_definitions enable row level security;
alter table user_dictionaries enable row level security;
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Public browsing: anyone (including anonymous) can read approved
-- dictionaries and shared vocabulary. Writing dictionary/term/definition
-- content is admin-only in v1 (service role, via the intake approval
-- flow) -- no insert/update/delete policies for regular users.
create policy "dictionaries are publicly readable when approved"
  on dictionaries for select
  using (status = 'approved');

create policy "authenticated users can submit a dictionary"
  on dictionaries for insert
  to authenticated
  with check (status = 'pending' and owner_user_id = auth.uid());

create policy "terms are publicly readable"
  on terms for select
  using (true);

create policy "definitions are publicly readable"
  on definitions for select
  using (true);

-- Personal data: owner-only, full stop. This is what makes private info
-- (notes, contact fields) never visible to anyone but the logged-in user.
create policy "users manage their own personal terms"
  on personal_terms for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "users manage their own personal definitions"
  on personal_definitions for all
  to authenticated
  using (
    exists (
      select 1 from personal_terms pt
      where pt.id = personal_definitions.personal_term_id
        and pt.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from personal_terms pt
      where pt.id = personal_definitions.personal_term_id
        and pt.owner_user_id = auth.uid()
    )
  );

create policy "users manage their own dictionary opt-ins"
  on user_dictionaries for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users read their own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "users update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users manage their own conversations"
  on conversations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own messages"
  on messages for all
  to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
