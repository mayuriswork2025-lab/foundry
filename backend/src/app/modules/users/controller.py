"""
Business logic + data access for the users module. Currently just the
founder search used when inviting collaborators onto a startup — raw SQL,
same reasoning as every other module here.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser
from .models import UserSummary


def search_founders(db: Session, user: CurrentUser, q: str) -> list[UserSummary]:
    query = q.strip()
    if len(query) < 2:
        return []

    rows = db.execute(
        text(
            """
            select u.user_id, u.first_name, u.last_name, u.email, u.department
            from users u
            join roles r on r.role_id = u.role_id
            where r.role_name = 'founder'
              and u.user_id != :caller_id
              and (
                  u.first_name ilike :pattern
                  or u.last_name ilike :pattern
                  or u.email ilike :pattern
              )
            order by u.first_name, u.last_name
            limit 10
            """
        ),
        {"caller_id": user.id, "pattern": f"%{query}%"},
    ).mappings().all()

    return [UserSummary.model_validate(dict(row)) for row in rows]


def list_suggested_mentors(db: Session) -> list[UserSummary]:
    """
    A small "suggested mentors" set for a founder deciding whether to
    request one — not the full mentor directory. Ranking is a placeholder
    (most recently joined) until there's real signal to rank on, e.g. how
    many startups a mentor has guided to completion.
    """
    rows = db.execute(
        text(
            """
            select u.user_id, u.first_name, u.last_name, u.email, u.department
            from users u
            join roles r on r.role_id = u.role_id
            where r.role_name = 'mentor'
            order by u.registration_date desc nulls last, u.first_name, u.last_name
            limit 5
            """
        )
    ).mappings().all()
    return [UserSummary.model_validate(dict(row)) for row in rows]
