-- ============================================================================
-- mentoring_rls.sql   |   Verify RLS + guards + RPCs for 20_mentoring.sql
-- ----------------------------------------------------------------------------
-- Run AFTER 50_seed_extended.sql. Run ONE block at a time. Every block is
-- wrapped in begin/rollback, so nothing is actually changed in the database.
-- ============================================================================


-- ========== A1 — a founder sees their own startup's mentor requests =========
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='priya@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.mentor_requests
  where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');
  reset role;
rollback;
-- EXPECT: 1


-- ========== A2 — a founder does NOT see another startup's mentor request ====
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='priya@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.mentor_requests
  where startup_id = (select startup_id from public.startups where startup_name = 'FinFlow');
  reset role;
rollback;
-- EXPECT: 0   (priya is not in FinFlow)


-- ========== A3 — a Member (not founder) cannot create a mentor request =====
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='sam@test.com'), true);
  set local role authenticated;
  insert into public.mentor_requests (startup_id, requested_by, required_skills)
  values ((select startup_id from public.startups where startup_name = 'EcoTrack'),
          (select user_id from public.users where email = 'sam@test.com'), 'Design');
  reset role;
rollback;
-- EXPECT: ERROR — new row violates row-level security policy for table "mentor_requests"


-- ========== A4 — the assigned mentor sees their own assignment =============
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='mentor@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.mentor_assignments
  where mentor_id = (select auth.uid());
  reset role;
rollback;
-- EXPECT: 1


-- ========== A5 — a founder (non-Admin) cannot approve their own request ====
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='arjun@test.com'), true);
  set local role authenticated;
  select public.approve_mentor_request(
    (select mentor_request_id from public.mentor_requests
       where startup_id = (select startup_id from public.startups where startup_name = 'FinFlow')),
    (select user_id from public.users where email = 'mentor@test.com'));
  reset role;
rollback;
-- EXPECT: ERROR — "Only an Admin can approve a mentor request."


-- ========== A6 — Admin approves a request, which creates the assignment ====
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='admin@test.com'), true);
  set local role authenticated;
  select mentor_request_id, mentor_id, status
  from public.approve_mentor_request(
    (select mentor_request_id from public.mentor_requests
       where startup_id = (select startup_id from public.startups where startup_name = 'FinFlow')),
    (select user_id from public.users where email = 'mentor@test.com'));
  reset role;
rollback;
-- EXPECT: 1 row, status = 'Active'


-- ========== A7 — the assigned mentor can update their own assignment =======
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='mentor@test.com'), true);
  set local role authenticated;
  with upd as (
    update public.mentor_assignments set status = 'Completed'
    where mentor_id = (select auth.uid())
    returning 1
  )
  select count(*) from upd;
  reset role;
rollback;
-- EXPECT: 1


-- ========== A8 — an unrelated founder cannot see another startup's meetings ==
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='arjun@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.meetings;
  reset role;
rollback;
-- EXPECT: 0   (arjun's only startup, FinFlow, has no assignment/meetings yet)
