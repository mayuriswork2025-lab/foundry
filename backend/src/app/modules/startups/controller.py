"""
Business logic + data access for the startups module. Raw SQL
(sqlalchemy.text), not the ORM query builder — see modules/auth/permissions.py
for why. router.py stays a thin route -> controller mapping; this is where
the actual decisions and queries live.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser
from ..auth.permissions import get_current_user_role, is_admin
from .models import Startup, StartupCreate


def list_startups(db: Session, user: CurrentUser) -> list[Startup]:
    """
    Equivalent of the removed "Founder access to own startup" RLS policy: an
    Admin sees every startup, everyone else sees only startups they're a
    member of. Enforced here instead of at the database.
    """
    if is_admin(db, user.id):
        return list_all_startups(db)

    return list_startups_for_member(db, user.id)


def list_all_startups(db: Session) -> list[Startup]:
    rows = db.execute(text("select * from startups")).mappings().all()
    return [Startup.model_validate(dict(row)) for row in rows]


def list_startups_for_member(db: Session, user_id: str) -> list[Startup]:
    rows = db.execute(
        text(
            """
            select s.*
            from startups s
            join startup_memberships sm on sm.startup_id = s.startup_id
            where sm.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().all()
    return [Startup.model_validate(dict(row)) for row in rows]


def create_startup(db: Session, user: CurrentUser, payload: StartupCreate) -> Startup:
    """
    Registers a new startup and makes the caller its founder, atomically.
    Only a founder or admin may do this — mirrors the old
    create_startup_with_founder() RPC's permission check.
    """
    role = get_current_user_role(db, user.id)
    if role not in ("founder", "admin"):
        raise HTTPException(status_code=403, detail="Only a founder or admin can register a startup.")

    row = db.execute(
        text(
            """
            insert into startups (startup_name, domain, description, registered_by)
            values (:startup_name, :domain, :description, :registered_by)
            returning *
            """
        ),
        {
            "startup_name": payload.startup_name,
            "domain": payload.domain,
            "description": payload.description,
            "registered_by": user.id,
        },
    ).mappings().first()

    db.execute(
        text(
            """
            insert into startup_memberships (startup_id, user_id, project_role)
            values (:startup_id, :user_id, 'founder')
            """
        ),
        {"startup_id": row["startup_id"], "user_id": user.id},
    )
    db.commit()

    return Startup.model_validate(dict(row))
