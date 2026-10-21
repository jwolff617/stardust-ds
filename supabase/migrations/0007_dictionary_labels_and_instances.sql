-- Dictionary labels, plus a generalized personal-instance system.
--
-- Labels: any number of short words attached to a dictionary (idea, match,
-- note, marketplace, matching...). They power dictionary search. The owner
-- of a dictionary writes its labels; shared dictionaries get theirs from
-- the seed files.
--
-- Instances: Night DS was the only template, so ensure_personal_instance()
-- hardcoded "'s Notes" and display_kind 'notes_list'. Profiles, Accounts DS,
-- and Worthy DS are templates too, so each template now names its own
-- instance suffix and Display View kind.

alter table dictionaries
  drop constraint if exists dictionaries_display_kind_check,
  add constraint dictionaries_display_kind_check
    check (display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy'));

alter table dictionaries
  add column if not exists instance_name_suffix text,
  add column if not exists instance_display_kind text
    check (instance_display_kind in ('term_table', 'notes_list', 'profile', 'accounts', 'worthy'));

update dictionaries
set instance_name_suffix = 'Notes', instance_display_kind = 'notes_list'
where address = 'night-ds';

create table if not exists dictionary_labels (
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  label text not null check (label = lower(trim(label)) and length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (dictionary_id, label)
);

create index if not exists dictionary_labels_label_idx on dictionary_labels(label);

alter table dictionary_labels enable row level security;

-- Readable for shared dictionaries and templates, for public profiles, and
-- for your own dictionaries. A private instance's labels (your Night DS,
-- Accounts, Worthy, Private Profile) stay yours.
create policy "dictionary labels readable where the dictionary is discoverable"
  on dictionary_labels for select
  using (
    exists (
      select 1 from dictionaries d
      left join dictionaries t on t.id = d.template_id
      where d.id = dictionary_labels.dictionary_id
        and d.status = 'approved'
        and (
          d.kind != 'instance'
          or t.address = 'public-profile'
          or d.owner_user_id = auth.uid()
        )
    )
  );

create policy "owners write their dictionary labels"
  on dictionary_labels for insert
  to authenticated
  with check (
    exists (
      select 1 from dictionaries d
      where d.id = dictionary_labels.dictionary_id and d.owner_user_id = auth.uid()
    )
  );

create policy "owners delete their dictionary labels"
  on dictionary_labels for delete
  to authenticated
  using (
    exists (
      select 1 from dictionaries d
      where d.id = dictionary_labels.dictionary_id and d.owner_user_id = auth.uid()
    )
  );

insert into dictionary_labels (dictionary_id, label)
select d.id, v.label
from (values
  ('core', 'core'), ('core', 'verbs'), ('core', 'nouns'),
  ('stardust', 'love'), ('stardust', 'feeling'), ('stardust', 'body'),
  ('stardust', 'spirit'), ('stardust', 'soul'),
  ('night-ds', 'note'), ('night-ds', 'notes'), ('night-ds', 'idea'),
  ('night-ds', 'journal')
) as v(address, label)
join dictionaries d on d.address = v.address
on conflict do nothing;

-- Internal: creates (or finds) a user's instance of a template and opts
-- them in. No auth check, so it is only callable from other security
-- definer functions (handle_new_user, backfills, ensure_personal_instance).
create or replace function create_personal_instance(
  p_template_id uuid,
  p_owner_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_instance_id uuid;
  v_template dictionaries%rowtype;
begin
  select * into v_template from dictionaries where id = p_template_id and kind = 'instance_template';
  if not found then
    raise exception 'Template dictionary not found.';
  end if;

  select id into v_instance_id
  from dictionaries
  where template_id = p_template_id and owner_user_id = p_owner_id;

  if v_instance_id is null then
    insert into dictionaries (
      address, name, description, kind, scope, status, locked,
      default_opt_in, owner_user_id, template_id, display_kind
    )
    values (
      v_template.address || '-' || substr(gen_random_uuid()::text, 1, 8),
      case
        when nullif(trim(p_display_name), '') is null then 'My '
        else trim(p_display_name) || '''s '
      end || coalesce(v_template.instance_name_suffix, v_template.name),
      v_template.description,
      'instance',
      'personal',
      'approved',
      v_template.locked,
      false,
      p_owner_id,
      p_template_id,
      coalesce(v_template.instance_display_kind, 'notes_list')
    )
    returning id into v_instance_id;
  end if;

  insert into user_dictionaries (user_id, dictionary_id, opted_in, opted_in_at)
  values (p_owner_id, v_instance_id, true, now())
  on conflict (user_id, dictionary_id)
  do update set opted_in = true, opted_in_at = now();

  return v_instance_id;
end;
$$;

revoke execute on function create_personal_instance(uuid, uuid, text) from public, anon, authenticated;

create or replace function ensure_personal_instance(
  p_template_id uuid,
  p_owner_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
begin
  if p_owner_id != auth.uid() then
    raise exception 'Cannot create a personal instance for another user.';
  end if;

  return create_personal_instance(p_template_id, p_owner_id, p_display_name);
end;
$$;

grant execute on function ensure_personal_instance(uuid, uuid, text) to authenticated;
