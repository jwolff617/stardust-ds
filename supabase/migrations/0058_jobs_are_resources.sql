-- Three profiles (2026-11-24): person, idea, resource. Jobs are resources
-- (money is a resource): a resource with details.what = 'job'. Hiring stays
-- offer, looking for work stays seek. The old 'job' kind is still allowed by
-- the check so nothing breaks mid-deploy, but nothing writes it anymore.

update profile_entries
set kind = 'resource',
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object('what', 'job')
where kind = 'job';

-- Matching a job matches jobs with jobs, things with things, inside resources.
-- (profile_matches already compares words; this keeps 'job' searches working.)
create or replace function profile_kind_of(p_kind text) returns text
language sql immutable as $$ select case when p_kind = 'job' then 'resource' else p_kind end $$;
