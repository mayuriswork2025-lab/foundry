-- ============================================================================
-- 50_seed_extended.sql   |   Demo data for modules A/B/C. Safe to re-run.
-- ----------------------------------------------------------------------------
-- PREREQUISITE — run 05_seed.sql first (creates admin/mentor/priya/arjun/sam).
-- Then create ONE more auth user first, same way as the other 5
-- (Authentication -> Users -> Add user, any password):
--
--     judge@test.com
--
-- Then run this whole file.
-- ============================================================================

-- ---- clear any previous run of this seed (children first) -------------------
delete from public.meetings;
delete from public.mentor_assignments;
delete from public.mentor_requests;
delete from public.funding_requests;
delete from public.evaluations;
delete from public.demo_days;

-- ---- 0. give the new test user a Judge system role --------------------------
update public.users set first_name = 'Nina', last_name = 'D''Souza',
    role_id = (select role_id from public.roles where role_name = 'Judge')
    where email = 'judge@test.com';

-- ============================================================================
-- Module A: mentoring
-- ============================================================================

-- ---- 1. mentor requests ------------------------------------------------------
insert into public.mentor_requests
    (startup_id, requested_by, required_skills, request_description, status)
values
    ((select startup_id from public.startups where startup_name = 'EcoTrack'),
     (select user_id   from public.users    where email = 'priya@test.com'),
     'Go-to-market, fundraising', 'Need help preparing for our seed round', 'Approved'),
    ((select startup_id from public.startups where startup_name = 'FinFlow'),
     (select user_id   from public.users    where email = 'arjun@test.com'),
     'Product, technical architecture', 'Need a technical sounding board', 'Pending');

update public.mentor_requests
    set decided_by = (select user_id from public.users where email = 'admin@test.com'),
        decision_date = current_date - 3
    where status = 'Approved'
      and startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');

-- ---- 2. the resulting assignment (only the Approved request has one) --------
insert into public.mentor_assignments (mentor_request_id, mentor_id, assigned_date, status)
values
    ((select mentor_request_id from public.mentor_requests
        where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack')),
     (select user_id from public.users where email = 'mentor@test.com'),
     current_date - 3, 'Active');

-- ---- 3. meetings under that assignment (one of each status) -----------------
insert into public.meetings (assignment_id, meeting_date, meeting_time, agenda, discussion, action_items, status)
values
    ((select assignment_id from public.mentor_assignments limit 1),
     current_date - 2, time '10:00', 'Kickoff', 'Reviewed pitch deck', 'Revise financials slide', 'Completed'),
    ((select assignment_id from public.mentor_assignments limit 1),
     current_date + 4, time '10:00', 'Follow-up', null, null, 'Scheduled');

-- ============================================================================
-- Module B: funding
-- ============================================================================
insert into public.funding_requests
    (startup_id, requested_amount, purpose, status)
values
    ((select startup_id from public.startups where startup_name = 'EcoTrack'),
     50000.00, 'Seed round to hire 2 engineers', 'Pending'),
    ((select startup_id from public.startups where startup_name = 'FinFlow'),
     20000.00, 'Cloud infrastructure and pilot costs', 'Pending');

-- ============================================================================
-- Module C: demo day
-- ============================================================================
insert into public.demo_days (event_name, event_date, venue)
values
    ('Cohort 4 Demo Day', current_date - 1, 'Main Auditorium'),
    ('Cohort 5 Demo Day', current_date + 30, 'Main Auditorium');

insert into public.evaluations
    (demo_day_id, startup_id, judge_id,
     innovation_score, technical_score, business_score, presentation_score, overall_remarks)
values
    ((select demo_day_id from public.demo_days where event_name = 'Cohort 4 Demo Day'),
     (select startup_id from public.startups  where startup_name = 'EcoTrack'),
     (select user_id    from public.users     where email = 'judge@test.com'),
     8.5, 7.0, 7.5, 8.0, 'Strong prototype, needs a clearer revenue model');

-- ---- see the result ----------------------------------------------------------
select mr.mentor_request_id, s.startup_name, mr.status, mr.required_skills
from public.mentor_requests mr join public.startups s on s.startup_id = mr.startup_id
order by mr.mentor_request_id;

select a.assignment_id, u.first_name || ' ' || u.last_name as mentor, a.status
from public.mentor_assignments a join public.users u on u.user_id = a.mentor_id
order by a.assignment_id;

select fr.funding_request_id, s.startup_name, fr.requested_amount, fr.status
from public.funding_requests fr join public.startups s on s.startup_id = fr.startup_id
order by fr.funding_request_id;

select e.evaluation_id, d.event_name, s.startup_name,
       u.first_name || ' ' || u.last_name as judge,
       e.innovation_score, e.technical_score, e.business_score, e.presentation_score
from public.evaluations e
join public.demo_days d on d.demo_day_id = e.demo_day_id
join public.startups  s on s.startup_id  = e.startup_id
join public.users     u on u.user_id     = e.judge_id
order by e.evaluation_id;
