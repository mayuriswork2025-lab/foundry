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
from ..auth.permissions import get_current_user_role, is_admin, is_startup_founder
from .models import InviteMemberRequest, Membership, Startup, StartupCreate, StartupUpdate


def list_startups(db: Session, user: CurrentUser) -> list[Startup]:
    """
    Equivalent of the removed "Founder access to own startup" RLS policy: an
    Admin sees every startup, a mentor browses every submitted (non-draft)
    startup, everyone else sees only startups they're a member of. Enforced
    here instead of at the database.
    """
    if is_admin(db, user.id):
        return list_all_startups(db)

    if get_current_user_role(db, user.id) == "mentor":
        return list_startups_for_mentor(db)

    return list_startups_for_member(db, user.id)


def list_all_startups(db: Session) -> list[Startup]:
    rows = db.execute(text("select * from startups")).mappings().all()
    return [Startup.model_validate(dict(row)) for row in rows]


def list_startups_for_mentor(db: Session) -> list[Startup]:
    """Mentors browse anything a founder has submitted — drafts stay private."""
    rows = db.execute(
        text("select * from startups where registration_status != 'draft' order by submitted_at desc")
    ).mappings().all()
    return [Startup.model_validate(dict(row)) for row in rows]


def list_startups_for_member(db: Session, user_id: str) -> list[Startup]:
    """
    member_status carries the caller's own membership status ('invited' or
    'accepted') for each row, so the frontend can show an accept-invite
    prompt without a separate lookup.
    """
    rows = db.execute(
        text(
            """
            select s.*, sm.status as member_status
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
    Registers a new startup as a draft and makes the caller its founder,
    atomically (registration_status defaults to 'draft' at the DB level —
    see submit_startup() for the draft -> pending transition). Only a
    founder or admin may do this — mirrors the old
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


def update_startup(db: Session, user: CurrentUser, startup_id: int, payload: StartupUpdate) -> Startup:
    """Edits the idea's basics. Only the founder may edit it."""
    if not is_startup_founder(db, user.id, startup_id):
        raise HTTPException(status_code=403, detail="Only the founder can edit this idea.")

    row = db.execute(
        text(
            """
            update startups
            set startup_name = :startup_name, domain = :domain, description = :description
            where startup_id = :startup_id
            returning *
            """
        ),
        {
            "startup_id": startup_id,
            "startup_name": payload.startup_name,
            "domain": payload.domain,
            "description": payload.description,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="This idea doesn't exist.")

    db.commit()
    return Startup.model_validate(dict(row))


def submit_startup(db: Session, user: CurrentUser, startup_id: int) -> Startup:
    """Promotes a draft to 'pending' review. Only the founder may submit it."""
    if not is_startup_founder(db, user.id, startup_id):
        raise HTTPException(status_code=403, detail="Only the founder can submit this idea.")

    row = db.execute(
        text(
            """
            update startups
            set registration_status = 'pending', submitted_at = now()
            where startup_id = :startup_id and registration_status = 'draft'
            returning *
            """
        ),
        {"startup_id": startup_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=409, detail="This idea has already been submitted or doesn't exist.")

    db.commit()
    return Startup.model_validate(dict(row))


def approve_startup(db: Session, user: CurrentUser, startup_id: int) -> Startup:
    """
    A mentor approves a pending idea, which also makes them a member of the
    startup (project_role = 'mentor') — that membership is what "Guiding
    Startups" lists later, so approving is how a mentor picks up an idea.
    """
    role = get_current_user_role(db, user.id)
    if role not in ("mentor", "admin"):
        raise HTTPException(status_code=403, detail="Only a mentor can approve an idea.")

    row = db.execute(
        text(
            """
            update startups
            set registration_status = 'approved'
            where startup_id = :startup_id and registration_status = 'pending'
            returning *
            """
        ),
        {"startup_id": startup_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=409, detail="This idea isn't pending review.")

    db.execute(
        text(
            """
            insert into startup_memberships (startup_id, user_id, project_role, status)
            values (:startup_id, :user_id, 'mentor', 'accepted')
            on conflict (user_id, startup_id) do nothing
            """
        ),
        {"startup_id": startup_id, "user_id": user.id},
    )
    db.commit()

    return Startup.model_validate(dict(row))


def invite_member(db: Session, user: CurrentUser, startup_id: int, payload: InviteMemberRequest) -> Membership:
    """Adds an existing registered user to a startup with a pending invite. Founder-only."""
    if not is_startup_founder(db, user.id, startup_id):
        raise HTTPException(status_code=403, detail="Only the founder can invite people onto this idea.")

    invitee = db.execute(
        text("select user_id from users where email = :email"),
        {"email": payload.email},
    ).first()
    if invitee is None:
        raise HTTPException(status_code=404, detail="No account found with that email.")

    existing = db.execute(
        text("select 1 from startup_memberships where startup_id = :startup_id and user_id = :user_id"),
        {"startup_id": startup_id, "user_id": invitee[0]},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This person is already invited or a member.")

    row = db.execute(
        text(
            """
            insert into startup_memberships (startup_id, user_id, project_role, status)
            values (:startup_id, :user_id, :project_role, 'invited')
            returning *
            """
        ),
        {"startup_id": startup_id, "user_id": invitee[0], "project_role": payload.project_role},
    ).mappings().first()
    db.commit()

    return _membership_with_user(db, row["membership_id"])


def accept_invite(db: Session, user: CurrentUser, startup_id: int) -> Membership:
    row = db.execute(
        text(
            """
            update startup_memberships
            set status = 'accepted'
            where startup_id = :startup_id and user_id = :user_id and status = 'invited'
            returning membership_id
            """
        ),
        {"startup_id": startup_id, "user_id": user.id},
    ).first()

    if row is None:
        raise HTTPException(status_code=404, detail="No pending invite found for this idea.")

    db.commit()
    return _membership_with_user(db, row[0])


def list_members(db: Session, user: CurrentUser, startup_id: int) -> list[Membership]:
    rows = db.execute(
        text(
            """
            select sm.membership_id, sm.startup_id, sm.user_id, sm.project_role, sm.status, sm.join_date,
                   u.first_name, u.last_name, u.email
            from startup_memberships sm
            join users u on u.user_id = sm.user_id
            where sm.startup_id = :startup_id
            order by sm.join_date
            """
        ),
        {"startup_id": startup_id},
    ).mappings().all()
    return [Membership.model_validate(dict(row)) for row in rows]


def _membership_with_user(db: Session, membership_id: int) -> Membership:
    row = db.execute(
        text(
            """
            select sm.membership_id, sm.startup_id, sm.user_id, sm.project_role, sm.status, sm.join_date,
                   u.first_name, u.last_name, u.email
            from startup_memberships sm
            join users u on u.user_id = sm.user_id
            where sm.membership_id = :membership_id
            """
        ),
        {"membership_id": membership_id},
    ).mappings().first()
    return Membership.model_validate(dict(row))
