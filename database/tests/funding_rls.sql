-- ============================================================================
-- funding_rls.sql   |   Verify RLS + guards + RPC for 30_funding.sql
-- ----------------------------------------------------------------------------
-- Run AFTER 50_seed_extended.sql. Run ONE block at a time. Every block is
-- wrapped in begin/rollback, so nothing is actually changed in the database.
-- ============================================================================


-- ========== B1 — a founder sees their own startup's funding request ========
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='priya@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.funding_requests
  where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');
  reset role;
rollback;
-- EXPECT: 1


-- ========== B2 — a Member (not founder) does NOT see it =====================
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='sam@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.funding_requests
  where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');
  reset role;
rollback;
-- EXPECT: 0   (Sam is a Member of EcoTrack, not a Founder)


-- ========== B3 — a Member cannot create a funding request ===================
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='sam@test.com'), true);
  set local role authenticated;
  insert into public.funding_requests (startup_id, requested_amount, purpose)
  values ((select startup_id from public.startups where startup_name = 'EcoTrack'), 500, 'test');
  reset role;
rollback;
-- EXPECT: ERROR — new row violates row-level security policy for table "funding_requests"


-- ========== B4 — a founder CAN create a funding request ====================
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='priya@test.com'), true);
  set local role authenticated;
  with ins as (
    insert into public.funding_requests (startup_id, requested_amount, purpose)
    values ((select startup_id from public.startups where startup_name = 'EcoTrack'), 500, 'test')
    returning 1
  )
  select count(*) from ins;
  reset role;
rollback;
-- EXPECT: 1


-- ========== B5 — a founder (non-Admin) cannot decide a funding request =====
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='priya@test.com'), true);
  set local role authenticated;
  select public.decide_funding_request(
    (select funding_request_id from public.funding_requests
       where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack')),
    'Approved', 40000);
  reset role;
rollback;
-- EXPECT: ERROR — "Only an Admin can decide a funding request."


-- ========== B6 — Admin approves, then a decided request can't reopen =======
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='admin@test.com'), true);
  set local role authenticated;

  select funding_request_id, status, approved_amount
  from public.decide_funding_request(
    (select funding_request_id from public.funding_requests
       where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack')),
    'Approved', 40000);
  -- EXPECT: 1 row, status = 'Approved', approved_amount = 40000.00

  update public.funding_requests set status = 'Pending', approved_amount = null
  where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');
  -- EXPECT: ERROR — "A decided funding request cannot be reopened to Pending."

  reset role;
rollback;
