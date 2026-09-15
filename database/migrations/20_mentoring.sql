-- ============================================================================
-- 20_mentoring.sql   |   Module A: mentor requests, assignments, meetings
-- ----------------------------------------------------------------------------
-- Requires: 01-08 (core module: users, startups, memberships, helper fns)
-- Builds:   mentor_requests, mentor_assignments, meetings
--           + this module's RLS policies, guard triggers, business functions
-- Apply in: Supabase Dashboard -> SQL Editor -> paste -> Run
-- ============================================================================


-- ============================================================================
-- STEP 1 — Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- mentor_requests : a startup asks for a mentor.
--   status lifecycle : Pending -> Approved | Rejected  (decided by Admin only)
--   decided_by / decision_date : filled in only once the request is decided
-- ----------------------------------------------------------------------------
create table public.mentor_requests (
    mentor_request_id   bigint generated always as identity primary key,
    startup_id          bigint      not null
                                    references public.startups (startup_id) on delete cascade,
    requested_by        uuid        not null
                                    references public.users (user_id) on delete cascade,
    required_skills     text,
    request_description text,
    status               text        not null default 'Pending',
    decided_by           uuid        references public.users (user_id) on delete set null,
    decision_date        date,
    remarks               text,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),

    constraint mentor_requests_status_check
        check (status in ('Pending', 'Approved', 'Rejected')),
    constraint mentor_requests_decision_needs_decided_status
        check (decision_date is null or status in ('Approved', 'Rejected'))
);

comment on table public.mentor_requests is
    'A startup''s ask for a mentor. Only an Admin decides (Approved/Rejected).';


-- ----------------------------------------------------------------------------
-- mentor_assignments : an approved request gets a mentor.
--   mentor_id must belong to a user whose system role is Mentor (guard below).
-- ----------------------------------------------------------------------------
create table public.mentor_assignments (
    assignment_id      bigint generated always as identity primary key,
    mentor_request_id  bigint      not null
                                   references public.mentor_requests (mentor_request_id) on delete cascade,
    mentor_id          uuid        not null
                                   references public.users (user_id) on delete cascade,
    assigned_date       date        not null default current_date,
    end_date             date,
    status                text        not null default 'Active',
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),

    constraint mentor_assignments_status_check
        check (status in ('Active', 'Completed', 'Cancelled')),
    constraint mentor_assignments_end_after_assigned
        check (end_date is null or end_date >= assigned_date),
    constraint mentor_assignments_unique_request_mentor
        unique (mentor_request_id, mentor_id)
);

comment on table public.mentor_assignments is
    'A mentor matched to an approved request. mentor_id must have system role Mentor.';


-- ----------------------------------------------------------------------------
-- meetings : mentor and startup meet, under one assignment.
-- ----------------------------------------------------------------------------
create table public.meetings (
    meeting_id     bigint generated always as identity primary key,
    assignment_id  bigint      not null
                               references public.mentor_assignments (assignment_id) on delete cascade,
    meeting_date    date        not null,
    meeting_time     time,
    agenda            text,
    discussion         text,
    action_items       text,
    status              text        not null default 'Scheduled',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    constraint meetings_status_check
        check (status in ('Scheduled', 'Completed', 'Cancelled'))
);

comment on table public.meetings is
    'One meeting between a mentor and the startup under a mentor_assignment.';


-- ----------------------------------------------------------------------------
-- Indexes (foreign keys are queried constantly by the policies below)
-- ----------------------------------------------------------------------------
create index idx_mentor_requests_startup_id     on public.mentor_requests    (startup_id);
create index idx_mentor_requests_requested_by   on public.mentor_requests    (requested_by);
create index idx_mentor_requests_decided_by     on public.mentor_requests    (decided_by);
create index idx_mentor_assignments_request_id  on public.mentor_assignments (mentor_request_id);
create index idx_mentor_assignments_mentor_id   on public.mentor_assignments (mentor_id);
create index idx_meetings_assignment_id         on public.meetings           (assignment_id);


-- ----------------------------------------------------------------------------
-- Row Level Security: lock all three tables. Policies are added in Step 4.
-- ----------------------------------------------------------------------------
alter table public.mentor_requests    enable row level security;
alter table public.mentor_assignments enable row level security;
alter table public.meetings           enable row level security;


-- ============================================================================
-- STEP 2 — Auto-update updated_at (reuses public.set_updated_at() from 04)
-- ============================================================================
drop trigger if exists trg_mentor_requests_updated_at on public.mentor_requests;
create trigger trg_mentor_requests_updated_at
    before update on public.mentor_requests
    for each row execute function public.set_updated_at();

drop trigger if exists trg_mentor_assignments_updated_at on public.mentor_assignments;
create trigger trg_mentor_assignments_updated_at
    before update on public.mentor_assignments
    for each row execute function public.set_updated_at();

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at
    before update on public.meetings
    for each row execute function public.set_updated_at();


-- ============================================================================
-- STEP 4 — Row Level Security policies
-- ----------------------------------------------------------------------------
-- Small SECURITY DEFINER helpers first, so a policy on one table can look
-- through to the startup/mentor that owns a related row without recursing
-- into that related table's own RLS (same trick as is_startup_member/founder
-- in 06_policies.sql).
-- ============================================================================
create or replace function public.mentor_request_startup(p_mentor_request_id bigint)
returns bigint
language sql stable security definer set search_path = ''
as $$
    select startup_id from public.mentor_requests
    where mentor_request_id = p_mentor_request_id;
$$;

create or replace function public.assignment_mentor_id(p_assignment_id bigint)
returns uuid
language sql stable security definer set search_path = ''
as $$
    select mentor_id from public.mentor_assignments
    where assignment_id = p_assignment_id;
$$;

create or replace function public.assignment_startup_id(p_assignment_id bigint)
returns bigint
language sql stable security definer set search_path = ''
as $$
    select public.mentor_request_startup(mentor_request_id)
    from public.mentor_assignments
    where assignment_id = p_assignment_id;
$$;

-- Drop any existing policies on our 3 tables, so this script is safe to re-run.
do $$
declare r record;
begin
    for r in
        select policyname, tablename from pg_policies
        where schemaname = 'public'
          and tablename in ('mentor_requests','mentor_assignments','meetings')
    loop
        execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;


-- ----------------------------------------------------------------------------
-- mentor_requests
--   read   : that startup's founders, the mentor already assigned to it, Admin
--   create : a founder of that startup, requesting as themselves
--   edit   : that startup's founders, or Admin  (guard below locks decision columns)
--   delete : that startup's founders, or Admin
-- ----------------------------------------------------------------------------
create policy mentor_requests_select on public.mentor_requests
    for select to authenticated
    using (
        public.is_admin()
        or public.is_startup_founder(startup_id)
        or exists (
            select 1 from public.mentor_assignments a
            where a.mentor_request_id = mentor_requests.mentor_request_id
              and a.mentor_id = (select auth.uid())
        )
    );

create policy mentor_requests_insert on public.mentor_requests
    for insert to authenticated
    with check (
        requested_by = (select auth.uid())
        and public.is_startup_founder(startup_id)
    );

create policy mentor_requests_update on public.mentor_requests
    for update to authenticated
    using  (public.is_admin() or public.is_startup_founder(startup_id))
    with check (public.is_admin() or public.is_startup_founder(startup_id));

create policy mentor_requests_delete on public.mentor_requests
    for delete to authenticated
    using (public.is_admin() or public.is_startup_founder(startup_id));


-- ----------------------------------------------------------------------------
-- mentor_assignments
--   read   : the assigned mentor, members of the owning startup, Admin
--   create : Admin only (normal path is approve_mentor_request(), Step 6)
--   edit   : the assigned mentor (their own status/end_date), or Admin
--   delete : Admin only
-- ----------------------------------------------------------------------------
create policy mentor_assignments_select on public.mentor_assignments
    for select to authenticated
    using (
        public.is_admin()
        or mentor_id = (select auth.uid())
        or public.is_startup_member(public.mentor_request_startup(mentor_request_id))
    );

create policy mentor_assignments_insert on public.mentor_assignments
    for insert to authenticated
    with check (public.is_admin());

create policy mentor_assignments_update on public.mentor_assignments
    for update to authenticated
    using  (public.is_admin() or mentor_id = (select auth.uid()))
    with check (public.is_admin() or mentor_id = (select auth.uid()));

create policy mentor_assignments_delete on public.mentor_assignments
    for delete to authenticated
    using (public.is_admin());


-- ----------------------------------------------------------------------------
-- meetings
--   read/write : the assigned mentor, or Admin
--   read only  : members of the owning startup
-- ----------------------------------------------------------------------------
create policy meetings_select on public.meetings
    for select to authenticated
    using (
        public.is_admin()
        or public.assignment_mentor_id(assignment_id) = (select auth.uid())
        or public.is_startup_member(public.assignment_startup_id(assignment_id))
    );

create policy meetings_insert on public.meetings
    for insert to authenticated
    with check (
        public.is_admin()
        or public.assignment_mentor_id(assignment_id) = (select auth.uid())
    );

create policy meetings_update on public.meetings
    for update to authenticated
    using  (public.is_admin() or public.assignment_mentor_id(assignment_id) = (select auth.uid()))
    with check (public.is_admin() or public.assignment_mentor_id(assignment_id) = (select auth.uid()));

create policy meetings_delete on public.meetings
    for delete to authenticated
    using (public.is_admin() or public.assignment_mentor_id(assignment_id) = (select auth.uid()));


-- ============================================================================
-- STEP 5 — Guard triggers (rules a policy can't express)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Only an Admin may decide a mentor request (status/decided_by/decision_date),
-- and a decided request can never be reopened back to Pending.
-- ----------------------------------------------------------------------------
create or replace function public.guard_mentor_request_decision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if (select auth.uid()) is null then return new; end if;   -- trusted context
    if public.is_admin() then
        if old.status in ('Approved', 'Rejected') and new.status = 'Pending' then
            raise exception 'A decided mentor request cannot be reopened to Pending.'
                using errcode = 'check_violation';
        end if;
        return new;
    end if;

    if new.status is distinct from old.status
       or new.decided_by is distinct from old.decided_by
       or new.decision_date is distinct from old.decision_date then
        raise exception 'Only an Admin can decide a mentor request.'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_mentor_requests_guard_decision on public.mentor_requests;
create trigger trg_mentor_requests_guard_decision
    before update on public.mentor_requests
    for each row execute function public.guard_mentor_request_decision();


-- ----------------------------------------------------------------------------
-- mentor_assignments.mentor_id must belong to a user whose system role is Mentor.
-- ----------------------------------------------------------------------------
create or replace function public.guard_mentor_assignment_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_role text;
begin
    select r.role_name into v_role
    from public.users u join public.roles r on r.role_id = u.role_id
    where u.user_id = new.mentor_id;

    if v_role is distinct from 'Mentor' then
        raise exception 'mentor_assignments.mentor_id must belong to a user whose role is Mentor.'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_mentor_assignments_guard_role on public.mentor_assignments;
create trigger trg_mentor_assignments_guard_role
    before insert or update of mentor_id on public.mentor_assignments
    for each row execute function public.guard_mentor_assignment_role();


-- ============================================================================
-- STEP 6 — Business functions (RPC)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- approve_mentor_request — Admin only. Decides the request AND creates the
-- assignment, atomically.
-- ----------------------------------------------------------------------------
create or replace function public.approve_mentor_request(
    p_mentor_request_id bigint,
    p_mentor_id         uuid
)
returns public.mentor_assignments
language plpgsql security definer set search_path = ''
as $$
declare
    v_assignment public.mentor_assignments;
begin
    if not public.is_admin() then
        raise exception 'Only an Admin can approve a mentor request.' using errcode = '42501';
    end if;

    update public.mentor_requests
    set status = 'Approved', decided_by = (select auth.uid()), decision_date = current_date
    where mentor_request_id = p_mentor_request_id and status = 'Pending';

    if not found then
        raise exception 'Mentor request % not found or already decided.', p_mentor_request_id
            using errcode = 'P0002';
    end if;

    insert into public.mentor_assignments (mentor_request_id, mentor_id)
    values (p_mentor_request_id, p_mentor_id)
    returning * into v_assignment;

    return v_assignment;
end;
$$;
revoke all on function public.approve_mentor_request(bigint, uuid) from public;
grant execute on function public.approve_mentor_request(bigint, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- reject_mentor_request — Admin only.
-- ----------------------------------------------------------------------------
create or replace function public.reject_mentor_request(
    p_mentor_request_id bigint,
    p_remarks           text default null
)
returns public.mentor_requests
language plpgsql security definer set search_path = ''
as $$
declare v_row public.mentor_requests;
begin
    if not public.is_admin() then
        raise exception 'Only an Admin can reject a mentor request.' using errcode = '42501';
    end if;

    update public.mentor_requests
    set status = 'Rejected',
        decided_by = (select auth.uid()),
        decision_date = current_date,
        remarks = coalesce(p_remarks, remarks)
    where mentor_request_id = p_mentor_request_id and status = 'Pending'
    returning * into v_row;

    if v_row is null then
        raise exception 'Mentor request % not found or already decided.', p_mentor_request_id
            using errcode = 'P0002';
    end if;
    return v_row;
end;
$$;
revoke all on function public.reject_mentor_request(bigint, text) from public;
grant execute on function public.reject_mentor_request(bigint, text) to authenticated;


-- ============================================================================
-- check
-- ============================================================================
select 'mentor_requests'    as tbl, count(*) as rows from public.mentor_requests
union all
select 'mentor_assignments' as tbl, count(*) as rows from public.mentor_assignments
union all
select 'meetings'           as tbl, count(*) as rows from public.meetings;

select tablename, cmd, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('mentor_requests','mentor_assignments','meetings')
order by tablename, cmd, policyname;
-- expect: 12 rows (4 per table)

select tgname as trigger_name, tgrelid::regclass as on_table
from pg_trigger
where tgname in ('trg_mentor_requests_guard_decision','trg_mentor_assignments_guard_role')
order by on_table;
-- expect: 2 rows
