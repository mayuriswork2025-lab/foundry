-- ============================================================================
-- mentoring_negative.sql   |   Every statement here MUST FAIL.
-- ----------------------------------------------------------------------------
-- Run ONE AT A TIME after 50_seed_extended.sql. Each should raise an error
-- naming the constraint that stopped it.
-- ============================================================================

-- (a) mentor_requests.status must be one of the three allowed values
insert into public.mentor_requests (startup_id, requested_by, status)
values ((select startup_id from public.startups where startup_name = 'FinFlow'),
        (select user_id   from public.users    where email = 'arjun@test.com'), 'Maybe');
-- expect: violates check constraint "mentor_requests_status_check"


-- (b) decision_date can't be set while status is still Pending
insert into public.mentor_requests (startup_id, requested_by, status, decision_date)
values ((select startup_id from public.startups where startup_name = 'FinFlow'),
        (select user_id   from public.users    where email = 'arjun@test.com'), 'Pending', current_date);
-- expect: violates check constraint "mentor_requests_decision_needs_decided_status"


-- (c) mentor_assignments.status must be one of the three allowed values
insert into public.mentor_assignments (mentor_request_id, mentor_id, status)
values ((select mentor_request_id from public.mentor_requests limit 1),
        (select user_id from public.users where email = 'mentor@test.com'), 'Paused');
-- expect: violates check constraint "mentor_assignments_status_check"


-- (d) mentor_assignments.mentor_id must belong to a user whose role is Mentor
--     (priya's system role is Founder, not Mentor)
insert into public.mentor_assignments (mentor_request_id, mentor_id)
values ((select mentor_request_id from public.mentor_requests
         where startup_id = (select startup_id from public.startups where startup_name = 'FinFlow')),
        (select user_id from public.users where email = 'priya@test.com'));
-- expect: mentor_assignments.mentor_id must belong to a user whose role is Mentor.


-- (e) the same mentor can't be assigned to the same request twice
insert into public.mentor_assignments (mentor_request_id, mentor_id)
values ((select mentor_request_id from public.mentor_requests
         where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack')),
        (select user_id from public.users where email = 'mentor@test.com'));
-- expect: violates unique constraint "mentor_assignments_unique_request_mentor"


-- (f) meetings.status must be one of the three allowed values
insert into public.meetings (assignment_id, meeting_date, status)
values ((select assignment_id from public.mentor_assignments limit 1), current_date, 'Ongoing');
-- expect: violates check constraint "meetings_status_check"


-- (g) a decided mentor request cannot be reopened to Pending
update public.mentor_requests set status = 'Pending'
where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');
-- expect: A decided mentor request cannot be reopened to Pending.
