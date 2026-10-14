-- Milestones get a real description, and meetings get redefined: scoped to
-- a milestone (not a mentor_assignment, which this app doesn't consistently
-- create — see mentoring/controller.py), scheduled_at as one timestamp
-- instead of separate date/time, and a scheduled_by to record who set it
-- up. action_items moves from free text to a real checklist table.
--
-- meetings has zero rows (never wired up to any code), so this is a clean
-- drop + recreate, not a delicate migration.

alter table milestones add column description text;

-- meeting_requested_at: a mentor's "please schedule a meeting" nudge.
-- Cleared automatically once a mentee actually schedules one.
alter table milestones add column meeting_requested_at timestamptz;

drop table if exists meetings;

create table meetings (
    meeting_id     serial primary key,
    milestone_id   int  not null references milestones(milestone_id) on delete cascade,
    scheduled_by   uuid not null references users(user_id) on delete cascade,
    scheduled_at   timestamptz not null,
    agenda         text,
    discussion     text,
    status         varchar(20) not null default 'scheduled'
        check (status in ('scheduled', 'completed', 'cancelled')),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create table meeting_action_items (
    action_item_id  serial primary key,
    meeting_id      int  not null references meetings(meeting_id) on delete cascade,
    item_text       text not null,
    is_done         boolean not null default false,
    created_at      timestamptz not null default now(),

    constraint meeting_action_item_not_blank check (length(trim(item_text)) > 0)
);

create table meeting_comments (
    comment_id   serial primary key,
    meeting_id   int  not null references meetings(meeting_id) on delete cascade,
    user_id      uuid not null references users(user_id) on delete cascade,
    body         text not null,
    created_at   timestamptz not null default now(),

    constraint meeting_comment_not_blank check (length(trim(body)) > 0)
);

create index idx_meeting_milestone_id on meetings (milestone_id);
create index idx_meeting_action_item_meeting_id on meeting_action_items (meeting_id);
create index idx_meeting_comment_meeting_id on meeting_comments (meeting_id);
