# Startup Incubator Management System

A full-stack application for managing startups, mentors, funding requests, milestones, and
demo day evaluations within a startup incubator program, backed by a
[Supabase](https://supabase.com) (Postgres) database.

## Tech stack

| Layer      | Choice                                                     |
| ---------- | ------------------------------------------------------------ |
| Database   | Supabase Postgres, used as vanilla Postgres (no PostgREST/RLS/supabase-py) |
| Auth       | Self-rolled: backend hashes passwords (bcrypt) and issues/verifies its own JWTs (PyJWT), no external auth provider |
| Migrations | Hand-written SQL, managed by the Supabase CLI               |
| Backend    | Python + FastAPI, managed with [uv](https://docs.astral.sh/uv/) |
| Frontend   | React + Vite + TypeScript, managed with pnpm                |

## Folder structure

```
.
├── backend/                # Python/FastAPI backend — see backend/README.md
│   ├── db/
│   │   ├── config.toml         # Local Supabase stack config
│   │   └── migrations/         # Numbered, hand-written SQL migrations (source of truth for schema)
│   ├── src/app/
│   │   ├── common/
│   │   │   └── model.py        # Shared Pydantic base (camelCase JSON aliasing) — backend-wide common code lives here
│   │   ├── db/
│   │   │   ├── client.py       # SQLAlchemy engine/session (reads DATABASE_URL)
│   │   │   ├── schema.py       # SQLAlchemy models, opt-in only (not used by default)
│   │   │   └── migrate.py      # Utility: applies db/migrations/*.sql directly via uv
│   │   ├── modules/
│   │   │   ├── auth/               # Verifies the caller's JWT (PyJWT), authorization checks
│   │   │   └── startups/           # One folder per business function: models/controller/router
│   │   └── main.py             # App assembly — mounts each module's router
│   ├── pyproject.toml
│   └── .env.example
└── frontend/                # React + Vite app (TypeScript), Tailwind v4 + shadcn/ui
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── index.css
    │   ├── components/          # Page sections + shadcn/ui primitives (components/ui/)
    │   ├── hooks/
    │   └── lib/
    ├── public/
    ├── components.json          # shadcn/ui CLI config
    ├── package.json
    └── .env.example
```

`backend/` and `frontend/` are two independent, self-contained projects — no shared root
tooling. `backend/` needs only `uv`; `frontend/` needs only `pnpm`.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (for the backend) — installs its own Python if needed
- Node.js 20+ and [pnpm](https://pnpm.io) (for the frontend)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (used via `npx supabase`, no global install required)
- Docker (only needed if you run the Supabase CLI's local stack; not required if you point
  `DATABASE_URL` at a hosted Supabase project instead)

## Getting started

1. **Configure environment variables** — each project has its own `.env.example`:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Fill in the real values (Supabase project settings from Project Settings → API in the
   dashboard, or the local values printed by `supabase start` if running the stack locally).

2. **Apply the database schema** — either via the Supabase CLI's local stack, or directly
   against a hosted Postgres database. See "Database migrations" below and
   `backend/README.md`.

3. **Run the backend:**

   ```bash
   ./backend/dev.sh
   ```

   (Hardcodes the env file and port — see `backend/README.md` if you want the raw command
   or need to change the port.)

4. **Run the frontend** (separate terminal):

   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

   - Backend: http://localhost:8000/api/hello (interactive docs at `/docs`)
   - Frontend: http://localhost:3000

## Database migrations

Schema changes are made as plain SQL files under `backend/db/migrations/`, applied in
filename order — these are the source of truth for the schema, not the SQLAlchemy models in
`backend/src/app/db/schema.py`.

- **Via the Supabase CLI** (from `backend/`, where `db/config.toml` lives):

  ```bash
  cd backend
  supabase --workdir db migration new <migration_name>   # create a new migration file
  supabase --workdir db start                             # start the local stack + apply migrations
  supabase --workdir db db reset                          # rebuild the local DB from scratch
  supabase --workdir db db push                           # push to a hosted Supabase project
  ```

- **Or directly with `uv`, no Supabase CLI/Docker needed** (useful against a hosted Postgres
  database) — see `backend/README.md`'s "Applying migrations" section.

- **After changing the schema**, update `backend/src/app/db/schema.py` to match.

## Schema

The current schema (see `backend/db/migrations/`) covers:

- `roles` — user roles (Admin, Mentor, Founder, Judge)
- `users` — platform users, linked 1:1 to Supabase `auth.users`
- `startups` — registered startups
- `startup_memberships` — many-to-many link between users and startups, with a project role
- `milestones` — startup milestones with due dates, completion tracking, and mentor verification
- `mentor_requests` — a startup's ask for a mentor
- `mentor_assignments` — a mentor matched to an approved request
- `meetings` — a meeting between a mentor and a startup under an assignment
- `funding_requests` — a startup's ask for funding
- `demo_days` — a demo day event
- `evaluations` — a judge's score sheet for a startup at a demo day

Table and column names, and every status/role value stored in them, are plain lowercase
snake_case (unquoted, standard Postgres convention) — not quoted CamelCase — so they behave
predictably in psql, the Supabase SQL editor, and any raw SQL written against them.

Tables carry structural constraints only (`NOT NULL`, `CHECK`, `UNIQUE`, foreign keys with
`ON DELETE` behavior, and indexes on FK columns). There is no Row Level Security, no guard
triggers, and no RPC functions in the database — the frontend never talks to Postgres
directly, so none of that would ever be evaluated for real traffic. Instead, all
authorization and business-rule enforcement (who may decide a mentor/funding request,
status-transition rules, role checks such as "the assigned mentor must have system role
Mentor," "no evaluations after the demo day has passed," and signing up a new user's profile
row) lives in the API layer:

- `backend/src/app/modules/auth/auth.py` — hashes/verifies passwords (bcrypt) and
  mints/verifies this backend's own JWTs (PyJWT); no external auth provider involved.
- `backend/src/app/modules/auth/permissions.py` — role/membership checks (`is_admin`,
  `is_startup_member`, `is_startup_founder`, `require_role`,
  `require_admin_or_startup_member`) that other modules' routes compose to decide what a
  request may do.

<!-- Startup Incubation Management Platform
Overview

The Startup Incubation Management Platform is a database-based system designed to manage the activities of startups within an incubation environment.

The system focuses on managing startups, users, roles, memberships, milestones, mentoring, funding, demo days, and evaluations.

Technology
Database: PostgreSQL
Platform: Supabase
Authentication: Supabase Auth
Development: VS Code
Language: SQL
Main Modules
User & Role Management
Startup Management
Startup Membership
Milestone Management
Mentoring
Funding
Demo Day
Evaluation
Project Focus

This project primarily focuses on the database and backend implementation using Supabase.

The database is designed to maintain relationships between different modules while ensuring data consistency, validation, and secure access.

Team Development

The project is divided into modules among team members, with each member responsible for implementing and integrating their assigned database components.

Status

The database implementation is currently being developed and verified module by module -->
