-- Adds a "draft" stage to a startup's lifecycle, so founders can save an
-- idea before submitting it for review. submitted_at tracks when a draft
-- was actually promoted to pending, separate from registration_date
-- (which is really "created" date).

alter table startups drop constraint startups_registration_status_check;
alter table startups add constraint startups_registration_status_check
    check (registration_status in ('draft', 'pending', 'approved', 'rejected'));
alter table startups alter column registration_status set default 'draft';

alter table startups add column submitted_at timestamptz;
