-- Mentoring module: mentor requests, mentor assignments, meetings.
-- Tables + constraints only. Authorization and status-transition rules
-- (who may decide a request, who may be assigned as mentor, etc.) are
-- enforced in the API layer, not here.

create table mentor_requests (
    mentor_request_id    serial primary key,
    startup_id           int  not null references startups(startup_id) on delete cascade,
    requested_by         uuid not null references users(user_id) on delete cascade,
    required_skills      text,
    request_description  text,
    status               varchar(20) not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    decided_by           uuid references users(user_id) on delete set null,
    decision_date        date,
    remarks              text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),

    constraint mentor_request_decision_needs_decided_status
        check (decision_date is null or status in ('approved', 'rejected'))
);

create table mentor_assignments (
    assignment_id      serial primary key,
    mentor_request_id  int  not null references mentor_requests(mentor_request_id) on delete cascade,
    mentor_id          uuid not null references users(user_id) on delete cascade,
    assigned_date      date not null default current_date,
    end_date           date,
    status             varchar(20) not null default 'active'
        check (status in ('active', 'completed', 'cancelled')),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),

    constraint mentor_assignment_end_after_assigned
        check (end_date is null or end_date >= assigned_date),
    constraint mentor_assignment_unique_request_mentor
        unique (mentor_request_id, mentor_id)
);

create table meetings (
    meeting_id     serial primary key,
    assignment_id  int  not null references mentor_assignments(assignment_id) on delete cascade,
    meeting_date   date not null,
    meeting_time   time,
    agenda         text,
    discussion     text,
    action_items   text,
    status         varchar(20) not null default 'scheduled'
        check (status in ('scheduled', 'completed', 'cancelled')),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index idx_mentor_request_startup_id    on mentor_requests    (startup_id);
create index idx_mentor_request_requested_by  on mentor_requests    (requested_by);
create index idx_mentor_request_decided_by    on mentor_requests    (decided_by);
create index idx_mentor_assignment_request_id on mentor_assignments (mentor_request_id);
create index idx_mentor_assignment_mentor_id  on mentor_assignments (mentor_id);
create index idx_meeting_assignment_id        on meetings           (assignment_id);
