-- ============================================================================
-- 40_demo_day.sql   |   Module C: demo days, evaluations
-- ----------------------------------------------------------------------------
-- Requires: 01-08 (core module: users, startups, memberships, helper fns)
-- Builds:   demo_days, evaluations
--           + this module's RLS policies, guard trigger, business function
-- Apply in: Supabase Dashboard -> SQL Editor -> paste -> Run
-- ============================================================================


-- ============================================================================
-- STEP 1 — Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- demo_days : one row per event. Admin-managed, everyone signed in can see it.
-- ----------------------------------------------------------------------------
create table public.demo_days (
    demo_day_id  bigint generated always as identity primary key,
    event_name    text        not null,
    event_date     date        not null,
    venue            text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),

    constraint demo_days_event_name_not_blank
        check (length(trim(event_name)) > 0)
);

comment on table public.demo_days is
    'A demo day event. Admin creates/manages it; anyone signed in can see it.';


-- ----------------------------------------------------------------------------
-- evaluations : a judge scores a startup at a demo day.
--   one score sheet per (demo_day, startup, judge) — the unique constraint.
-- ----------------------------------------------------------------------------
create table public.evaluations (
    evaluation_id       bigint generated always as identity primary key,
    demo_day_id          bigint      not null
                                     references public.demo_days (demo_day_id) on delete cascade,
    startup_id             bigint      not null
                                       references public.startups (startup_id) on delete cascade,
    judge_id                 uuid        not null
                                         references public.users (user_id) on delete cascade,
    innovation_score           numeric(4,2),
    technical_score              numeric(4,2),
    business_score                 numeric(4,2),
    presentation_score               numeric(4,2),
    overall_remarks                    text,
    created_at                          timestamptz not null default now(),
    updated_at                          timestamptz not null default now(),

    constraint evaluations_innovation_score_range
        check (innovation_score   is null or innovation_score   between 0 and 10),
    constraint evaluations_technical_score_range
        check (technical_score    is null or technical_score    between 0 and 10),
    constraint evaluations_business_score_range
        check (business_score     is null or business_score     between 0 and 10),
    constraint evaluations_presentation_score_range
        check (presentation_score is null or presentation_score between 0 and 10),
    constraint evaluations_unique_judge_per_startup_per_day
        unique (demo_day_id, startup_id, judge_id)
);

comment on table public.evaluations is
    'One judge''s score sheet for one startup at one demo day.';


-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index idx_evaluations_demo_day_id on public.evaluations (demo_day_id);
create index idx_evaluations_startup_id  on public.evaluations (startup_id);
create index idx_evaluations_judge_id    on public.evaluations (judge_id);


-- ----------------------------------------------------------------------------
-- Row Level Security: lock both tables. Policies are added in Step 4.
-- ----------------------------------------------------------------------------
alter table public.demo_days   enable row level security;
alter table public.evaluations enable row level security;


-- ============================================================================
-- STEP 2 — Auto-update updated_at (reuses public.set_updated_at() from 04)
-- ============================================================================
drop trigger if exists trg_demo_days_updated_at on public.demo_days;
create trigger trg_demo_days_updated_at
    before update on public.demo_days
    for each row execute function public.set_updated_at();

drop trigger if exists trg_evaluations_updated_at on public.evaluations;
create trigger trg_evaluations_updated_at
    before update on public.evaluations
    for each row execute function public.set_updated_at();


-- ============================================================================
-- STEP 4 — Row Level Security policies
-- ============================================================================
do $$
declare r record;
begin
    for r in
        select policyname, tablename from pg_policies
        where schemaname = 'public' and tablename in ('demo_days','evaluations')
    loop
        execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;


-- ----------------------------------------------------------------------------
-- demo_days — everyone signed in can read; only Admin writes
-- ----------------------------------------------------------------------------
create policy demo_days_select on public.demo_days
    for select to authenticated using (true);

create policy demo_days_insert on public.demo_days
    for insert to authenticated with check (public.is_admin());

create policy demo_days_update on public.demo_days
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy demo_days_delete on public.demo_days
    for delete to authenticated using (public.is_admin());


-- ----------------------------------------------------------------------------
-- evaluations
--   read   : the judge who wrote it, members of the evaluated startup, Admin
--   create : a Judge, scoring as themselves
--   edit   : the judge who wrote it, or Admin
--   delete : the judge who wrote it, or Admin
-- ----------------------------------------------------------------------------
create policy evaluations_select on public.evaluations
    for select to authenticated
    using (
        public.is_admin()
        or judge_id = (select auth.uid())
        or public.is_startup_member(startup_id)
    );

create policy evaluations_insert on public.evaluations
    for insert to authenticated
    with check (
        judge_id = (select auth.uid())
        and public.current_user_role() = 'Judge'
    );

create policy evaluations_update on public.evaluations
    for update to authenticated
    using  (public.is_admin() or judge_id = (select auth.uid()))
    with check (public.is_admin() or judge_id = (select auth.uid()));

create policy evaluations_delete on public.evaluations
    for delete to authenticated
    using (public.is_admin() or judge_id = (select auth.uid()));


-- ============================================================================
-- STEP 5 — Guard trigger
-- ----------------------------------------------------------------------------
-- No new (or edited) evaluations once the demo day's event_date has passed.
-- Admin is exempt, for corrections.
-- ============================================================================
create or replace function public.guard_evaluation_demo_day_not_passed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_event_date date;
begin
    if (select auth.uid()) is null then return new; end if;   -- trusted context
    if public.is_admin() then return new; end if;

    select event_date into v_event_date from public.demo_days where demo_day_id = new.demo_day_id;
    if v_event_date < current_date then
        raise exception 'Cannot add or change an evaluation after the demo day has passed.'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_evaluations_guard_demo_day_not_passed on public.evaluations;
create trigger trg_evaluations_guard_demo_day_not_passed
    before insert or update on public.evaluations
    for each row execute function public.guard_evaluation_demo_day_not_passed();


-- ============================================================================
-- STEP 6 — Business function
-- ----------------------------------------------------------------------------
-- submit_evaluation — Judge only. One score sheet per judge per startup per
-- demo day; calling it again for the same trio updates the existing sheet.
-- ============================================================================
create or replace function public.submit_evaluation(
    p_demo_day_id        bigint,
    p_startup_id          bigint,
    p_innovation_score     numeric,
    p_technical_score        numeric,
    p_business_score           numeric,
    p_presentation_score         numeric,
    p_overall_remarks               text default null
)
returns public.evaluations
language plpgsql security definer set search_path = ''
as $$
declare
    v_uid   uuid := (select auth.uid());
    v_row   public.evaluations;
begin
    if public.current_user_role() is distinct from 'Judge' then
        raise exception 'Only a Judge can submit an evaluation.' using errcode = '42501';
    end if;

    insert into public.evaluations
        (demo_day_id, startup_id, judge_id,
         innovation_score, technical_score, business_score, presentation_score, overall_remarks)
    values
        (p_demo_day_id, p_startup_id, v_uid,
         p_innovation_score, p_technical_score, p_business_score, p_presentation_score, p_overall_remarks)
    on conflict (demo_day_id, startup_id, judge_id) do update
        set innovation_score   = excluded.innovation_score,
            technical_score    = excluded.technical_score,
            business_score     = excluded.business_score,
            presentation_score = excluded.presentation_score,
            overall_remarks    = excluded.overall_remarks
    returning * into v_row;

    return v_row;
end;
$$;
revoke all on function public.submit_evaluation(bigint, bigint, numeric, numeric, numeric, numeric, text) from public;
grant execute on function public.submit_evaluation(bigint, bigint, numeric, numeric, numeric, numeric, text) to authenticated;


-- ============================================================================
-- check
-- ============================================================================
select 'demo_days'   as tbl, count(*) as rows from public.demo_days
union all
select 'evaluations' as tbl, count(*) as rows from public.evaluations;

select tablename, cmd, policyname
from pg_policies
where schemaname = 'public' and tablename in ('demo_days','evaluations')
order by tablename, cmd, policyname;
-- expect: 8 rows (4 per table)

select tgname as trigger_name, tgrelid::regclass as on_table
from pg_trigger
where tgname = 'trg_evaluations_guard_demo_day_not_passed';
-- expect: 1 row
