-- Test data for exercising /api/startups. Not a migration, not run automatically —
-- paste into the Supabase SQL editor, or run with psql, after substituting :founder_id.
--
-- Prerequisite: create a real user first (Dashboard -> Authentication -> Add user,
-- any email/password). Copy that user's UUID and paste it in place of :founder_id
-- below (or pass it as a psql variable, same as the old seed.sql did):
--   psql "$DATABASE_URL" -v founder_id="'<paste-uuid-here>'" -f db/test_data.sql

-- Profile row — no signup trigger exists, so this backend creates it manually
-- (an API layer job normally; here we do it by hand for test data).
insert into users (user_id, role_id, first_name, last_name, email)
values (
    :founder_id,
    (select role_id from roles where role_name = 'founder'),
    'Test',
    'Founder',
    'test-founder@example.com'
)
on conflict (user_id) do nothing;

-- A couple of startups, owned by that user.
insert into startups (startup_name, domain, description, registration_status, current_stage, registered_by)
values
    ('EcoTrack', 'CleanTech', 'Carbon footprint tracker for SMEs', 'approved', 'MVP', :founder_id),
    ('FinFlow',  'FinTech',   'Cash-flow forecasting for freelancers', 'pending', 'Idea', :founder_id)
returning startup_id, startup_name;

-- Membership rows — without these, GET /api/startups (as a non-admin) returns
-- an empty list even though the rows above exist, since the route only shows
-- startups the caller is a member of.
insert into startup_memberships (user_id, startup_id, project_role)
select :founder_id, startup_id, 'founder'
from startups
where startup_name in ('EcoTrack', 'FinFlow');

-- Sanity check: this is what GET /api/startups should return for :founder_id.
select s.*
from startups s
join startup_memberships sm on sm.startup_id = s.startup_id
where sm.user_id = :founder_id;
