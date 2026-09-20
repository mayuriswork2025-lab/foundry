-- ============================================================
-- 20_mentoring.sql
-- Mentoring module
-- ============================================================

create table public.mentor_requests (
    mentor_request_id bigint generated always as identity primary key,

    startup_id bigint not null
        references public.startups(startup_id)
        on delete cascade,

    requested_by uuid not null
        references public.users(user_id)
        on delete restrict,

    required_skills text,

    request_description text,

    status text not null default 'Pending'
        check (status in ('Pending', 'Approved', 'Rejected')),

    decided_by uuid
        references public.users(user_id)
        on delete set null,

    decision_date date,

    remarks text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_mentor_requests_startup_id
    on public.mentor_requests (startup_id);

create index idx_mentor_requests_requested_by
    on public.mentor_requests (requested_by);

create index idx_mentor_requests_decided_by
    on public.mentor_requests (decided_by);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.mentor_requests enable row level security;

-- ============================================================
-- Updated At Trigger
-- ============================================================

create trigger trg_mentor_requests_updated_at
before update on public.mentor_requests
for each row
execute function public.set_updated_at();