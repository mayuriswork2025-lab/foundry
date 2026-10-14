-- Demo day participants: judges (mentors self-signing up to evaluate) and
-- startups (founders/teammates marking their own startup ready) for a demo
-- day, plus the columns needed to support recurring monthly demo days
-- (lazily created by the API) alongside one-off ("special") ones an admin
-- creates explicitly.

alter table demo_days
    add column theme varchar(150),
    add column kind varchar(20) not null default 'special'
        check (kind in ('monthly', 'special'));

create table demo_day_judges (
    demo_day_id  int  not null references demo_days(demo_day_id) on delete cascade,
    mentor_id    uuid not null references users(user_id) on delete cascade,
    created_at   timestamptz not null default now(),

    primary key (demo_day_id, mentor_id)
);

create table demo_day_startups (
    demo_day_id  int not null references demo_days(demo_day_id) on delete cascade,
    startup_id   int not null references startups(startup_id) on delete cascade,
    created_at   timestamptz not null default now(),

    primary key (demo_day_id, startup_id)
);

create index idx_demo_day_judges_mentor_id on demo_day_judges (mentor_id);
create index idx_demo_day_startups_startup_id on demo_day_startups (startup_id);
