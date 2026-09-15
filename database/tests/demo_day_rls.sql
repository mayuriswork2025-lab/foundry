-- ============================================================================
-- demo_day_rls.sql   |   Verify RLS + guards + RPC for 40_demo_day.sql
-- ----------------------------------------------------------------------------
-- Run AFTER 50_seed_extended.sql. Run ONE block at a time. Every block is
-- wrapped in begin/rollback, so nothing is actually changed in the database.
-- ============================================================================


-- ========== C1 — anyone signed in can read demo_days ========================
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='sam@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.demo_days;
  reset role;
rollback;
-- EXPECT: 2


-- ========== C2 — a non-Admin cannot create a demo_day ========================
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='sam@test.com'), true);
  set local role authenticated;
  insert into public.demo_days (event_name, event_date) values ('Rogue Event', current_date + 1);
  reset role;
rollback;
-- EXPECT: ERROR — new row violates row-level security policy for table "demo_days"


-- ========== C3 — a Judge can submit an evaluation for a future demo day =====
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='judge@test.com'), true);
  set local role authenticated;
  select evaluation_id, innovation_score
  from public.submit_evaluation(
    (select demo_day_id from public.demo_days where event_name = 'Cohort 5 Demo Day'),
    (select startup_id  from public.startups  where startup_name = 'FinFlow'),
    9, 8, 8.5, 9, 'Great pitch');
  reset role;
rollback;
-- EXPECT: 1 row


-- ========== C4 — a non-Judge cannot submit an evaluation directly ===========
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='priya@test.com'), true);
  set local role authenticated;
  insert into public.evaluations (demo_day_id, startup_id, judge_id, innovation_score)
  values ((select demo_day_id from public.demo_days where event_name = 'Cohort 5 Demo Day'),
          (select startup_id  from public.startups  where startup_name = 'FinFlow'),
          (select auth.uid()), 9);
  reset role;
rollback;
-- EXPECT: ERROR — new row violates row-level security policy for table "evaluations"


-- ========== C5 — a Judge cannot evaluate a demo day that already passed ====
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='judge@test.com'), true);
  set local role authenticated;
  select public.submit_evaluation(
    (select demo_day_id from public.demo_days where event_name = 'Cohort 4 Demo Day'),
    (select startup_id  from public.startups  where startup_name = 'FinFlow'),
    9, 9, 9, 9, null);
  reset role;
rollback;
-- EXPECT: ERROR — "Cannot add or change an evaluation after the demo day has passed."


-- ========== C6 — a member of the evaluated startup can see the score =======
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='sam@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.evaluations
  where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');
  reset role;
rollback;
-- EXPECT: 1   (Sam is a Member of EcoTrack, which was scored in the seed data)


-- ========== C7 — an unrelated founder cannot see that score =================
begin;
  select set_config('request.jwt.claims',
    (select json_build_object('sub', user_id)::text from public.users where email='arjun@test.com'), true);
  set local role authenticated;
  select count(*) as visible from public.evaluations
  where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack');
  reset role;
rollback;
-- EXPECT: 0   (arjun is not a member of EcoTrack)
