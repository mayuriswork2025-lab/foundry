-- Lets a founder pick up to 3 specific mentors to send a request to,
-- instead of always broadcasting to every mentor's inbox. A request with
-- no rows here is still a broadcast (visible to all mentors). The cap of 3
-- is enforced at the API layer (Pydantic), not here.

create table mentor_request_targets (
    mentor_request_id  int  not null references mentor_requests(mentor_request_id) on delete cascade,
    mentor_id          uuid not null references users(user_id) on delete cascade,

    primary key (mentor_request_id, mentor_id)
);
