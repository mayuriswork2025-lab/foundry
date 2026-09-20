-- Demo day module: demo days, evaluations.
-- Tables + constraints only. Who may create a demo day, who may submit an
-- evaluation, and the "no evaluations after the event date" rule are all
-- enforced in the API layer, not here.

create table demo_days (
    demo_day_id  serial primary key,
    event_name   varchar(150) not null,
    event_date   date not null,
    venue        varchar(150),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    constraint demo_day_event_name_not_blank check (length(trim(event_name)) > 0)
);

create table evaluations (
    evaluation_id        serial primary key,
    demo_day_id          int  not null references demo_days(demo_day_id) on delete cascade,
    startup_id           int  not null references startups(startup_id) on delete cascade,
    judge_id             uuid not null references users(user_id) on delete cascade,
    innovation_score     numeric(4,2),
    technical_score      numeric(4,2),
    business_score       numeric(4,2),
    presentation_score   numeric(4,2),
    overall_remarks      text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),

    constraint evaluation_innovation_score_range
        check (innovation_score   is null or innovation_score   between 0 and 10),
    constraint evaluation_technical_score_range
        check (technical_score    is null or technical_score    between 0 and 10),
    constraint evaluation_business_score_range
        check (business_score     is null or business_score     between 0 and 10),
    constraint evaluation_presentation_score_range
        check (presentation_score is null or presentation_score between 0 and 10),
    constraint evaluation_unique_judge_per_startup_per_day
        unique (demo_day_id, startup_id, judge_id)
);

create index idx_evaluation_demo_day_id on evaluations (demo_day_id);
create index idx_evaluation_startup_id  on evaluations (startup_id);
create index idx_evaluation_judge_id    on evaluations (judge_id);
