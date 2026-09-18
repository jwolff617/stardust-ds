-- Stardust DS core schema.
-- Everything is a Term + Definition. Dictionaries, users, and businesses all
-- ride the same structure; "kind" is what makes a dictionary behave like a
-- User Dictionary or Business Dictionary rather than a topical one.

create extension if not exists "pgcrypto";

create table dictionaries (
  id uuid primary key default gen_random_uuid(),
  address text unique not null,
  name text not null,
  kind text not null check (kind in ('core', 'stardust', 'topical', 'user', 'business')),
  owner_user_id uuid references auth.users(id),
  is_permanent boolean not null default false,
  is_default_on boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  trust_labels text[] not null default '{}',
  -- Key into a small frontend registry of custom View components (e.g.
  -- 'stardust-spiral', 'goodnight-spiral'). Null means Console 2 shows the
  -- default Dictionary/list view for this dictionary -- opt-in, not required.
  custom_view_key text,
  created_at timestamptz not null default now()
);

-- The literal string. One row per distinct term, shared across every
-- dictionary that defines it -- multiple dictionaries can each attach their
-- own Definition to the same term without duplicating the term itself.
create table terms (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  part_of_speech text check (part_of_speech in ('verb', 'noun', 'adjective', 'adverb')),
  created_at timestamptz not null default now()
);

-- A single dictionary's meaning for a term.
create table definitions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id) on delete cascade,
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  body text not null,
  creator_user_id uuid references auth.users(id),
  -- Opt-in position score, formerly "XYZ score." Nullable -- most
  -- dictionaries (Core included) never set these. A dictionary that wants
  -- "terms as points in a meaning-space" (Stardust is the first) fills them
  -- in on its own definitions and pairs them with a custom View (see
  -- dictionaries.custom_view_key) that renders a nearness browser. No
  -- separate voting table -- a position is just a field like any other,
  -- editable by whoever can edit the definition.
  xyz_x smallint check (xyz_x between 0 and 100),
  xyz_y smallint check (xyz_y between 0 and 100),
  xyz_z smallint check (xyz_z between 0 and 100),
  created_at timestamptz not null default now(),
  unique (term_id, dictionary_id)
);

create table labels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table definition_labels (
  definition_id uuid not null references definitions(id) on delete cascade,
  label_id uuid not null references labels(id) on delete cascade,
  primary key (definition_id, label_id)
);

-- Thumbs up/down.
create table votes (
  definition_id uuid not null references definitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (definition_id, user_id)
);

-- Which dictionaries a user has turned on. Core is always on and is not
-- expected to appear here as "off" -- enforced at the application layer.
create table user_collections (
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  is_on boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, dictionary_id)
);

-- Choose: which definition a user has active for a term that more than one
-- of their turned-on dictionaries defines.
create table term_resolutions (
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  chosen_definition_id uuid not null references definitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, term_id)
);

-- Data-driven verb -> required noun-shape mapping, e.g. Call requires
-- Phone Number. Keeps this out of application code.
create table verb_requirements (
  verb_term_id uuid not null references terms(id) on delete cascade,
  required_noun_term_id uuid not null references terms(id) on delete cascade,
  primary key (verb_term_id, required_noun_term_id)
);

-- Default verbs a dictionary of a given kind exposes as executable
-- Sage AI functions (e.g. every 'business' dictionary gets Call).
create table kind_verbs (
  kind text not null check (kind in ('core', 'stardust', 'topical', 'user', 'business')),
  verb_term_id uuid not null references terms(id) on delete cascade,
  primary key (kind, verb_term_id)
);

-- Verbs a specific dictionary adds beyond its kind's defaults (e.g. a
-- business dictionary's own custom actions). Only ever executable by Sage AI
-- when the owning dictionary's status is 'approved'.
create table dictionary_verbs (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  verb_term_id uuid not null references terms(id) on delete cascade,
  primary key (dictionary_id, verb_term_id)
);

create index definitions_dictionary_id_idx on definitions(dictionary_id);
create index definitions_term_id_idx on definitions(term_id);
create index definition_labels_label_id_idx on definition_labels(label_id);
create index user_collections_user_id_idx on user_collections(user_id);
