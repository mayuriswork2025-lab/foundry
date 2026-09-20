-- Initial schema for the Startup Incubator Management System.
-- Table/column names are plain lowercase snake_case (Postgres's own
-- convention) rather than quoted CamelCase, so they behave predictably
-- unquoted in psql, the Supabase SQL editor, and raw SQL elsewhere.

drop table if exists milestones cascade;
drop table if exists startup_memberships cascade;
drop table if exists startups cascade;
drop table if exists users cascade;
drop table if exists roles cascade;

create table roles (
    role_id     serial primary key,
    role_name   varchar(50) not null,
    description text,

    constraint role_name_unique    unique (role_name),
    constraint role_name_not_blank check  (length(trim(role_name)) > 0)
);

create table users (
    user_id            uuid primary key references auth.users(id) on delete cascade,
    role_id            int not null references roles(role_id),
    first_name         varchar(50) not null,
    last_name          varchar(50) not null,
    email              varchar(100) unique not null,
    phone              varchar(20) unique,
    department         varchar(100),
    registration_date  date default current_date,
    status             varchar(20) default 'active'
        check (status in ('active', 'inactive', 'suspended')),

    constraint user_first_name_not_blank check (length(trim(first_name)) > 0),
    constraint user_last_name_not_blank  check (length(trim(last_name))  > 0)
);

create table startups (
    startup_id           serial primary key,
    startup_name         varchar(100) not null,
    domain               varchar(100),
    description          text,
    registration_date    date default current_date,
    registration_status  varchar(20) default 'pending'
        check (registration_status in ('pending', 'approved', 'rejected')),
    current_stage        varchar(50),
    registered_by        uuid references users(user_id) on delete set null,

    constraint startup_name_not_blank check (length(trim(startup_name)) > 0)
);

create table startup_memberships (
    membership_id serial primary key,
    user_id       uuid not null references users(user_id) on delete cascade,
    startup_id    int not null references startups(startup_id) on delete cascade,
    project_role  varchar(50),
    join_date     date default current_date,

    constraint membership_unique_user_per_startup unique (user_id, startup_id),
    constraint membership_project_role_check check (project_role in ('founder', 'member'))
);

create table milestones (
    milestone_id          serial primary key,
    startup_id            int not null references startups(startup_id) on delete cascade,
    milestone_name        varchar(100) not null,
    due_date              date,
    completion_date       date,
    status                varchar(20) default 'pending'
        check (status in ('pending', 'in_progress', 'completed')),
    verification_status   varchar(20)
        check (verification_status in ('unverified', 'verified', 'rejected')),
    mentor_remarks        text,

    constraint milestone_name_not_blank check (length(trim(milestone_name)) > 0),
    constraint milestone_unique_name_per_startup unique (startup_id, milestone_name),
    constraint milestone_completion_needs_completed_status
        check (completion_date is null or status = 'completed')
);

-- Foreign-key indexes. Postgres does not create these automatically, and the
-- API layer will query these columns constantly.
create index idx_startup_registered_by  on startups            (registered_by);
create index idx_membership_startup_id  on startup_memberships (startup_id);
create index idx_membership_user_id     on startup_memberships (user_id);
create index idx_milestone_startup_id   on milestones          (startup_id);

-- No Row Level Security here: the backend connects to Postgres directly
-- (via DATABASE_URL) rather than the frontend talking to Supabase directly,
-- so RLS policies would never be evaluated for real traffic. Authorization
-- (who may read/write which rows — "a founder manages their own startup,"
-- "only admin sees everything," etc.) is implemented in the API layer
-- instead: see backend/src/app/modules/auth/permissions.py.

-- No on_auth_user_created trigger / handle_new_user() function here: creating
-- the "users" profile row after a Supabase Auth signup is the API layer's job
-- (call it right after auth.signUp() succeeds), not a database side effect.

insert into roles (role_name, description) values
('admin', 'Full platform access'),
('mentor', 'Advises assigned startups'),
('founder', 'Registers and runs a startup'),
('judge', 'Scores startups at demo days');
