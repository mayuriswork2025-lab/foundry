-- ============================================================================
-- funding_negative.sql   |   Every statement here MUST FAIL.
-- ----------------------------------------------------------------------------
-- Run ONE AT A TIME after 50_seed_extended.sql. Each should raise an error
-- naming the constraint that stopped it.
-- ============================================================================

-- (a) requested_amount must be positive
insert into public.funding_requests (startup_id, requested_amount)
values ((select startup_id from public.startups where startup_name = 'EcoTrack'), -100);
-- expect: violates check constraint "funding_requests_amount_positive"


-- (b) status must be one of the three allowed values
insert into public.funding_requests (startup_id, requested_amount, status)
values ((select startup_id from public.startups where startup_name = 'EcoTrack'), 1000, 'Under Review');
-- expect: violates check constraint "funding_requests_status_check"


-- (c) approved_amount can't be set while status is still Pending
insert into public.funding_requests (startup_id, requested_amount, status, approved_amount)
values ((select startup_id from public.startups where startup_name = 'EcoTrack'), 1000, 'Pending', 500);
-- expect: violates check constraint "funding_requests_approved_amount_needs_approved_status"


-- (d) only an Admin can decide a funding request (enforced by the guard trigger)
--     run this impersonating priya (see funding_rls.sql) — direct SQL Editor
--     runs bypass RLS/guards for auth.uid()=null, so this one is proven in
--     funding_rls.sql instead, block F2.


-- (e) a decided funding request cannot be reopened to Pending
update public.funding_requests set status = 'Pending', approved_amount = null
where funding_request_id = (
    select funding_request_id from public.funding_requests
    where startup_id = (select startup_id from public.startups where startup_name = 'EcoTrack')
    limit 1
);
-- run this AFTER decide_funding_request() has approved that row (see funding_rls.sql D-block)
-- expect: A decided funding request cannot be reopened to Pending.
