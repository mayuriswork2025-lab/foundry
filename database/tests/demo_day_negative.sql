-- ============================================================================
-- demo_day_negative.sql   |   Every statement here MUST FAIL.
-- ----------------------------------------------------------------------------
-- Run ONE AT A TIME after 50_seed_extended.sql. Each should raise an error
-- naming the constraint that stopped it.
-- ============================================================================

-- (a) demo_days.event_name cannot be blank
insert into public.demo_days (event_name, event_date) values ('   ', current_date + 10);
-- expect: violates check constraint "demo_days_event_name_not_blank"


-- (b) a score must be between 0 and 10
insert into public.evaluations
    (demo_day_id, startup_id, judge_id, innovation_score)
values
    ((select demo_day_id from public.demo_days where event_name = 'Cohort 5 Demo Day'),
     (select startup_id  from public.startups  where startup_name = 'FinFlow'),
     (select user_id     from public.users     where email = 'judge@test.com'),
     15);
-- expect: violates check constraint "evaluations_innovation_score_range"


-- (c) one score sheet per judge per startup per demo day
insert into public.evaluations
    (demo_day_id, startup_id, judge_id, innovation_score, technical_score, business_score, presentation_score)
values
    ((select demo_day_id from public.demo_days where event_name = 'Cohort 4 Demo Day'),
     (select startup_id  from public.startups  where startup_name = 'EcoTrack'),
     (select user_id     from public.users     where email = 'judge@test.com'),
     9, 9, 9, 9);
-- expect: violates unique constraint "evaluations_unique_judge_per_startup_per_day"


-- (d) no new evaluation once the demo day has passed (enforced by the guard
--     trigger; direct SQL Editor runs bypass it because auth.uid() is null —
--     this is proven under real impersonation in demo_day_rls.sql instead)
