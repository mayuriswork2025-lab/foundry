-- ============================================================================
-- 30_funding.sql   |   Module B: funding requests
-- ----------------------------------------------------------------------------
-- Requires: 01-08 (core module: users, startups, memberships, helper fns)
-- Builds:   funding_requests
--           + this module's RLS policies, guard trigger, business function
-- Apply in: Supabase Dashboard -> SQL Editor -> paste -> Run
-- ============================================================================


-- ============================================================================
-- STEP 1 — Table
-- ============================================================================

-- ----------------------------------------------------------------------------
-- funding_requests : a startup asks for money.
--   status lifecycle  : Pending -> Approved | Rejected  (Admin only)
--   approved_amount   : only ever set when status = 'Approved'
-- ----------------------------------------------------------------------------
create table public.funding_requests (
    funding_request_id  bigint generated always as identity primary key,
    startup_id           bigint      not null
                                     references public.startups (startup_id) on delete cascade,
    requested_amount      numeric(12,2) not null,
    purpose                 text,
    status                   text        not null default 'Pending',
    approved_amount          numeric(12,2),
    decided_by                uuid        references public.users (user_id) on delete set null,
    decision_date              date,
    remarks                      text,
    created_at                    timestamptz not null default now(),
    updated_at                    timestamptz not null default now(),

    constraint funding_requests_amount_positive
        check (requested_amount > 0),
    constraint funding_requests_status_check
        check (status in ('Pending', 'Approved', 'Rejected')),
    constraint funding_requests_approved_amount_needs_approved_status
        check (approved_amount is null or status = 'Approved'),
    constraint funding_requests_approved_amount_positive
        check (approved_amount is null or approved_amount > 0),
    constraint funding_requests_decision_needs_decided_status
        check (decision_date is null or status in ('Approved', 'Rejected'))
);

comment on table public.funding_requests is
    'A startup''s ask for funding. Only an Admin decides (Approved/Rejected).';


-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index idx_funding_requests_startup_id on public.funding_requests (startup_id);
create index idx_funding_requests_decided_by on public.funding_requests (decided_by);


-- ----------------------------------------------------------------------------
-- Row Level Security: lock the table. Policies are added in Step 4.
-- ----------------------------------------------------------------------------
alter table public.funding_requests enable row level security;


-- ============================================================================
-- STEP 2 — Auto-update updated_at (reuses public.set_updated_at() from 04)
-- ============================================================================
drop trigger if exists trg_funding_requests_updated_at on public.funding_requests;
create trigger trg_funding_requests_updated_at
    before update on public.funding_requests
    for each row execute function public.set_updated_at();


-- ============================================================================
-- STEP 4 — Row Level Security policies
--   read   : that startup's founders, or Admin
--   create : a founder of that startup
--   edit   : that startup's founders, or Admin  (guard below locks decision columns)
--   delete : that startup's founders, or Admin
-- ============================================================================
do $$
declare r record;
begin
    for r in
        select policyname, tablename from pg_policies
        where schemaname = 'public' and tablename = 'funding_requests'
    loop
        execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

create policy funding_requests_select on public.funding_requests
    for select to authenticated
    using (public.is_admin() or public.is_startup_founder(startup_id));

create policy funding_requests_insert on public.funding_requests
    for insert to authenticated
    with check (public.is_startup_founder(startup_id));

create policy funding_requests_update on public.funding_requests
    for update to authenticated
    using  (public.is_admin() or public.is_startup_founder(startup_id))
    with check (public.is_admin() or public.is_startup_founder(startup_id));

create policy funding_requests_delete on public.funding_requests
    for delete to authenticated
    using (public.is_admin() or public.is_startup_founder(startup_id));


-- ============================================================================
-- STEP 5 — Guard trigger
-- ----------------------------------------------------------------------------
-- Only an Admin may decide a funding request (status/approved_amount/
-- decided_by/decision_date), and a decided request can never be reopened
-- back to Pending.
-- ============================================================================
create or replace function public.guard_funding_request_decision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if (select auth.uid()) is null then return new; end if;   -- trusted context
    if public.is_admin() then
        if old.status in ('Approved', 'Rejected') and new.status = 'Pending' then
            raise exception 'A decided funding request cannot be reopened to Pending.'
                using errcode = 'check_violation';
        end if;
        return new;
    end if;

    if new.status is distinct from old.status
       or new.approved_amount is distinct from old.approved_amount
       or new.decided_by is distinct from old.decided_by
       or new.decision_date is distinct from old.decision_date then
        raise exception 'Only an Admin can decide a funding request.'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_funding_requests_guard_decision on public.funding_requests;
create trigger trg_funding_requests_guard_decision
    before update on public.funding_requests
    for each row execute function public.guard_funding_request_decision();


-- ============================================================================
-- STEP 6 — Business function
-- ----------------------------------------------------------------------------
-- decide_funding_request — Admin only. Approve (with amount) or reject, in
-- one call.
-- ============================================================================
create or replace function public.decide_funding_request(
    p_funding_request_id bigint,
    p_status              text,
    p_approved_amount     numeric default null,
    p_remarks             text default null
)
returns public.funding_requests
language plpgsql security definer set search_path = ''
as $$
declare v_row public.funding_requests;
begin
    if not public.is_admin() then
        raise exception 'Only an Admin can decide a funding request.' using errcode = '42501';
    end if;
    if p_status not in ('Approved', 'Rejected') then
        raise exception 'status must be Approved or Rejected.' using errcode = '23514';
    end if;
    if p_status = 'Approved' and (p_approved_amount is null or p_approved_amount <= 0) then
        raise exception 'approved_amount must be a positive number when approving.' using errcode = '23514';
    end if;

    update public.funding_requests
    set status = p_status,
        approved_amount = case when p_status = 'Approved' then p_approved_amount else null end,
        decided_by = (select auth.uid()),
        decision_date = current_date,
        remarks = coalesce(p_remarks, remarks)
    where funding_request_id = p_funding_request_id and status = 'Pending'
    returning * into v_row;

    if v_row is null then
        raise exception 'Funding request % not found or already decided.', p_funding_request_id
            using errcode = 'P0002';
    end if;
    return v_row;
end;
$$;
revoke all on function public.decide_funding_request(bigint, text, numeric, text) from public;
grant execute on function public.decide_funding_request(bigint, text, numeric, text) to authenticated;


-- ============================================================================
-- check
-- ============================================================================
select 'funding_requests' as tbl, count(*) as rows from public.funding_requests;

select tablename, cmd, policyname
from pg_policies
where schemaname = 'public' and tablename = 'funding_requests'
order by cmd, policyname;
-- expect: 4 rows

select tgname as trigger_name, tgrelid::regclass as on_table
from pg_trigger
where tgname = 'trg_funding_requests_guard_decision';
-- expect: 1 row
