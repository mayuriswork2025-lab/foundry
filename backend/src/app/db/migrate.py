"""
Applies the hand-written SQL migrations under db/migrations/ (the single
source of truth for the schema, not this backend's SQLAlchemy models)
against DATABASE_URL, in filename order. Already-applied files are tracked
in a `schema_migrations` table, so re-running only picks up new ones.

This is a lightweight alternative to `supabase db push`, useful when you're
pointed at a hosted Postgres database directly and don't want to run the
Supabase CLI/Docker locally.

Usage (from backend/):
    uv run --env-file .env python src/app/db/migrate.py

Or from the repo root:
    uv run --directory backend --env-file .env python src/app/db/migrate.py

Deliberately standalone (no imports from the rest of `app`) so it can be run
as a plain script without needing the package to be installed.
"""

from __future__ import annotations

import os
from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "db" / "migrations"


def main() -> None:
    connection_string = os.environ.get("DATABASE_URL")
    if not connection_string:
        raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and fill it in.")

    # DATABASE_URL is SQLAlchemy-style (postgresql+psycopg://...) so the rest
    # of the app picks the psycopg3 driver; raw psycopg.connect() doesn't
    # understand the "+psycopg" driver suffix, so strip it here.
    connection_string = connection_string.replace("postgresql+psycopg://", "postgresql://")

    if not MIGRATIONS_DIR.is_dir():
        raise RuntimeError(f"Migrations directory not found: {MIGRATIONS_DIR}")

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        print(f"No migration files found in {MIGRATIONS_DIR}.")
        return

    with psycopg.connect(connection_string, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                create table if not exists schema_migrations (
                    filename    text primary key,
                    applied_at  timestamptz not null default now()
                )
                """
            )
            cur.execute("select filename from schema_migrations")
            applied = {row[0] for row in cur.fetchall()}
        conn.commit()

        pending = [f for f in migration_files if f.name not in applied]
        if not pending:
            print("Already up to date. Nothing to apply.")
            return

        for migration_file in pending:
            print(f"Applying {migration_file.name} ...")
            sql = migration_file.read_text()
            with conn.cursor() as cur:
                cur.execute(sql)
                cur.execute(
                    "insert into schema_migrations (filename) values (%s)",
                    (migration_file.name,),
                )
            conn.commit()

        print(f"Applied {len(pending)} migration(s).")


if __name__ == "__main__":
    main()
