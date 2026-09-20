from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...db.client import get_db
from .auth import CurrentUser, get_current_user

"""
Authorization helpers. These replace the RLS policies/is_admin() that used to
live in the database — with the frontend never talking to Postgres directly,
enforcement has to happen here instead.

Raw SQL throughout (not the ORM query builder) — these are simple lookups,
not worth going through `schema.py`'s declarative models for. Reach for the
ORM only where its behavior (relationship loading, identity map, etc.)
actually earns its keep.
"""


def get_current_user_role(db: Session, user_id: str) -> str | None:
    row = db.execute(
        text(
            """
            select r.role_name
            from users u
            join roles r on r.role_id = u.role_id
            where u.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).first()
    return row[0] if row else None


def is_admin(db: Session, user_id: str) -> bool:
    return get_current_user_role(db, user_id) == "admin"


def is_startup_member(db: Session, user_id: str, startup_id: int) -> bool:
    row = db.execute(
        text(
            """
            select membership_id
            from startup_memberships
            where user_id = :user_id and startup_id = :startup_id
            """
        ),
        {"user_id": user_id, "startup_id": startup_id},
    ).first()
    return row is not None


def is_startup_founder(db: Session, user_id: str, startup_id: int) -> bool:
    row = db.execute(
        text(
            """
            select membership_id
            from startup_memberships
            where user_id = :user_id
              and startup_id = :startup_id
              and project_role = 'founder'
            """
        ),
        {"user_id": user_id, "startup_id": startup_id},
    ).first()
    return row is not None


def require_role(*roles: str):
    """FastAPI dependency factory: 403s unless the caller's system role is one of `roles`."""

    def dependency(
        user: CurrentUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> CurrentUser:
        current_role = get_current_user_role(db, user.id)
        if not current_role or current_role not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {' or '.join(roles)}.")
        return user

    return dependency


def require_admin_or_startup_member(
    startup_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """
    FastAPI dependency: 403s unless the caller is an Admin or a member of the
    startup identified by the `startup_id` path parameter. Mirrors the old
    "Founder access to own startup" / "Membership visible to startup members" /
    "Milestone access" RLS policies, which despite the name only required
    membership, not specifically Founder.
    """
    if is_admin(db, user.id) or is_startup_member(db, user.id, startup_id):
        return user
    raise HTTPException(status_code=403, detail="Not a member of this startup.")
