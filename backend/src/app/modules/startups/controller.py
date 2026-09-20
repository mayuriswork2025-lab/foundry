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
from ..auth.permissions import is_admin
from .models import (
    Startup,
    StartupCreate,
    StartupMilestoneInsight,
    StartupStageCount,
    StartupUpdate,
)


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


def _ensure_user_profile(db: Session, user: CurrentUser) -> None:
    """
    There's no on_auth_user_created DB trigger (see db/migrations) — creating
    the `users` profile row for a freshly-signed-up Supabase Auth user is an
    API layer job. Called before any write that needs a `users` row to exist
    for a foreign key (e.g. `startups.registered_by`), so a first-time caller
    isn't blocked by a missing profile.
    """
    local_part = (user.email or "user").split("@", 1)[0]
    db.execute(
        text(
            """
            insert into users (user_id, role_id, first_name, last_name, email)
            select :user_id, (select role_id from roles where role_name = 'founder'),
                   :first_name, 'User', coalesce(:email, :user_id || '@example.com')
            on conflict (user_id) do nothing
            """
        ),
        {"user_id": user.id, "first_name": local_part, "email": user.email},
    )


def create_startup(db: Session, user: CurrentUser, payload: StartupCreate) -> Startup:
    _ensure_user_profile(db, user)

    row = db.execute(
        text(
            """
            insert into startups (startup_name, domain, description, current_stage, registered_by)
            values (:startup_name, :domain, :description, :current_stage, :registered_by)
            returning *
            """
        ),
        {
            "startup_name": payload.startup_name,
            "domain": payload.domain,
            "description": payload.description,
            "current_stage": payload.current_stage,
            "registered_by": user.id,
        },
    ).mappings().one()

    db.execute(
        text(
            """
            insert into startup_memberships (user_id, startup_id, project_role)
            values (:user_id, :startup_id, 'founder')
            """
        ),
        {"user_id": user.id, "startup_id": row["startup_id"]},
    )

    db.commit()
    return Startup.model_validate(dict(row))


def get_startup(db: Session, startup_id: int) -> Startup:
    row = db.execute(
        text("select * from startups where startup_id = :startup_id"),
        {"startup_id": startup_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Startup not found.")
    return Startup.model_validate(dict(row))


def update_startup(db: Session, startup_id: int, payload: StartupUpdate) -> Startup:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return get_startup(db, startup_id)

    set_clause = ", ".join(f"{column} = :{column}" for column in updates)
    row = db.execute(
        text(f"update startups set {set_clause} where startup_id = :startup_id returning *"),
        {**updates, "startup_id": startup_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Startup not found.")

    db.commit()
    return Startup.model_validate(dict(row))


def delete_startup(db: Session, startup_id: int) -> None:
    result = db.execute(
        text("delete from startups where startup_id = :startup_id"),
        {"startup_id": startup_id},
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Startup not found.")
    db.commit()


def get_stage_counts(db: Session, user: CurrentUser) -> list[StartupStageCount]:
    """Aggregate query: number of startups per `current_stage`, scoped like list_startups."""
    if is_admin(db, user.id):
        rows = db.execute(
            text(
                """
                select current_stage, count(*) as startup_count
                from startups
                group by current_stage
                order by startup_count desc
                """
            )
        ).mappings().all()
    else:
        rows = db.execute(
            text(
                """
                select s.current_stage, count(*) as startup_count
                from startups s
                join startup_memberships sm on sm.startup_id = s.startup_id
                where sm.user_id = :user_id
                group by s.current_stage
                order by startup_count desc
                """
            ),
            {"user_id": user.id},
        ).mappings().all()
    return [StartupStageCount.model_validate(dict(row)) for row in rows]


def get_above_average_milestone_startups(db: Session, user: CurrentUser) -> list[StartupMilestoneInsight]:
    """
    Nested query: startups whose milestone count is above the average milestone
    count per startup (subquery in the HAVING clause), scoped like list_startups.
    """
    scope_join = ""
    scope_where = ""
    params: dict = {}
    if not is_admin(db, user.id):
        scope_join = "join startup_memberships sm on sm.startup_id = s.startup_id"
        scope_where = "where sm.user_id = :user_id"
        params["user_id"] = user.id

    rows = db.execute(
        text(
            f"""
            select s.startup_id, s.startup_name, count(m.milestone_id) as milestone_count
            from startups s
            {scope_join}
            left join milestones m on m.startup_id = s.startup_id
            {scope_where}
            group by s.startup_id, s.startup_name
            having count(m.milestone_id) > (
                select coalesce(avg(milestone_count), 0)
                from (
                    select count(*) as milestone_count
                    from milestones
                    group by startup_id
                ) per_startup
            )
            order by milestone_count desc
            """
        ),
        params,
    ).mappings().all()
    return [StartupMilestoneInsight.model_validate(dict(row)) for row in rows]
