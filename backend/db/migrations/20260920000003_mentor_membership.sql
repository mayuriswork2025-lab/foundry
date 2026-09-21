-- Approving an idea makes the approving mentor a member of the startup
-- (project_role = 'mentor'), so "which startups am I guiding" is just a
-- membership lookup like everything else, not a separate table.

alter table startup_memberships drop constraint membership_project_role_check;
alter table startup_memberships add constraint membership_project_role_check
    check (project_role in ('founder', 'member', 'mentor'));
