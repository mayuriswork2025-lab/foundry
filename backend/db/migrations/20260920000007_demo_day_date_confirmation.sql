-- Lets a founder/teammate confirm the demo day date for their joined
-- startup (surfaced back on the idea page once confirmed), instead of that
-- confirmation living only as throwaway frontend state.

alter table demo_day_startups
    add column confirmed_at timestamptz;
