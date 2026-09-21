-- Lets a founder invite an existing registered user onto their
-- startup/draft without a separate invitations table. A row with
-- status = 'invited' is a pending invite; the invitee flips it to
-- 'accepted' themselves. The founder's own membership row (inserted at
-- draft creation) defaults straight to 'accepted'.

alter table startup_memberships
    add column status varchar(20) not null default 'accepted'
        check (status in ('invited', 'accepted'));
