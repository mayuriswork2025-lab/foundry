-- Move off Supabase Auth: this backend now owns credentials and issues its
-- own JWTs (see modules/auth/controller.py), rather than the frontend
-- calling Supabase's Auth API. Supabase is now purely the Postgres database.

-- users.user_id no longer has to be a Supabase Auth id.
alter table users drop constraint if exists users_user_id_fkey;
alter table users alter column user_id set default gen_random_uuid();

-- Password storage. Backfill for any pre-existing rows (dev/seed data) with
-- an unusable hash, then make it required going forward.
alter table users add column if not exists password_hash text;
update users set password_hash = '' where password_hash is null;
alter table users alter column password_hash set not null;
