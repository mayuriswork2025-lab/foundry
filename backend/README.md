# backend

The Python/FastAPI backend for the Startup Incubator Management System.

No pnpm/Node required for this package — everything here runs through `uv`.

## Project structure

```
backend/
├── db/
│   ├── config.toml         # Local Supabase stack config
│   └── migrations/         # Hand-written SQL migrations — source of truth for the schema
├── src/app/
│   ├── common/                  # Backend-wide shared code, not specific to any one module
│   │   └── model.py                # ApiModel: shared Pydantic base (camelCase JSON aliasing)
│   ├── db/
│   │   ├── client.py           # SQLAlchemy engine/session (reads DATABASE_URL)
│   │   ├── schema.py           # SQLAlchemy models, opt-in only (not used by default)
│   │   └── migrate.py          # Utility: applies db/migrations/*.sql directly via uv
│   ├── modules/
│   │   ├── auth/                   # Auth/authorization, used by every other module
│   │   │   ├── auth.py                 # Verifies the caller's JWT locally (PyJWT)
│   │   │   └── permissions.py          # Role/membership authorization checks
│   │   └── startups/               # One folder per business function
│   │       ├── models.py               # Pydantic shapes this module returns
│   │       ├── controller.py           # Business logic + raw SQL data access
│   │       └── router.py               # Thin route -> controller mapping
│   └── main.py                 # App assembly: creates FastAPI app, mounts each
│                                # module's router — no route logic itself
├── pyproject.toml
└── .env.example
```

New business function → new `modules/<name>/` folder with the same
`models.py`/`controller.py`/`router.py` shape (auth is the one module without
a `router.py`/`models.py` of its own — it's infrastructure every other module
depends on, not an endpoint). Nothing here uses the ORM (`db/schema.py`) by
default — routes go router → controller → raw SQL (`sqlalchemy.text`), parsed
into that module's own small Pydantic models in `models.py`, built on the
shared `ApiModel` base in `common/model.py`. Reach for `db/schema.py` only where
actual ORM behavior (relationship loading, identity map, etc.) earns its
keep; regenerate it with `sqlacodegen` against the live DB rather than
hand-maintaining it, if you do.

Run it:

```bash
cp .env.example .env   # fill in the real values first time
./dev.sh                # from backend/, or ./backend/dev.sh from the repo root
```

`dev.sh` just hardcodes the env file and port so you don't retype them — edit the `PORT`
variable inside it if 8000 is taken. What it runs, if you want the raw command instead:

```bash
uv run --env-file .env python -m uvicorn app.main:app --app-dir src --reload --port 8000
```

(Use `python -m uvicorn`, not the bare `fastapi dev`/`uvicorn` commands — on some machines those
resolve to an unrelated global Python install instead of this project's `uv`-managed
virtualenv, causing confusing `NoSuchModuleError`/import errors that have nothing to do with
your code. Forcing it through `python -m` avoids that — `dev.sh` already does this correctly.)

## Auth

Supabase is used purely as Postgres + an auth token issuer here — no `supabase-py`, no
PostgREST/REST API, no network call back to Supabase on each request.
`src/app/modules/auth/auth.py` verifies the caller's JWT locally with `PyJWT`, using the
token issuer's signing secret (`JWT_SECRET` — Supabase's is under Project Settings → API →
JWT Settings in the dashboard).

Trade-off: a session Supabase itself has revoked (sign-out, ban) still passes here until the
JWT's own expiry, since nothing checks back with Supabase's Auth API.

## db/

`db/migrations/*.sql` in this directory is the source of truth for the schema — this
backend's SQLAlchemy models (`src/app/db/schema.py`) mirror it but never create or alter
tables themselves. `db/config.toml` is the Supabase CLI's project config.

### Via the Supabase CLI

Run these from this directory (`backend/`), so they pick up `db/config.toml`:

```bash
supabase --workdir db migration new <migration_name>   # create a new migration file
supabase --workdir db start                             # start the local stack + apply migrations
supabase --workdir db db reset                          # rebuild the local DB from scratch
supabase --workdir db db push                           # push to a hosted Supabase project
supabase --workdir db db diff                           # diff local schema vs. migrations
supabase --workdir db stop                               # stop the local stack
```

### Applying migrations without the Supabase CLI

If you're not running the Supabase CLI/Docker locally (e.g. you're pointed at a hosted
Supabase Postgres directly via `DATABASE_URL`), apply pending migrations directly with `uv`:

```bash
uv run --env-file .env python src/app/db/migrate.py
# or from the repo root:
uv run --directory backend --env-file .env python src/app/db/migrate.py
```

It runs each `db/migrations/*.sql` file in filename order and records what's been
applied in a `schema_migrations` table, so re-running only picks up new files.
