-- Funding module: funding requests.
-- Tables + constraints only. The approve/reject decision rule (Admin-only)
-- is enforced in the API layer, not here.

create table funding_requests (
    funding_request_id  serial primary key,
    startup_id          int  not null references startups(startup_id) on delete cascade,
    requested_amount    numeric(12,2) not null,
    purpose              text,
    status               varchar(20) not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    approved_amount      numeric(12,2),
    decided_by           uuid references users(user_id) on delete set null,
    decision_date        date,
    remarks              text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),

    constraint funding_request_amount_positive
        check (requested_amount > 0),
    constraint funding_request_approved_amount_needs_approved_status
        check (approved_amount is null or status = 'approved'),
    constraint funding_request_approved_amount_positive
        check (approved_amount is null or approved_amount > 0),
    constraint funding_request_decision_needs_decided_status
        check (decision_date is null or status in ('approved', 'rejected'))
);

create index idx_funding_request_startup_id on funding_requests (startup_id);
create index idx_funding_request_decided_by on funding_requests (decided_by);
