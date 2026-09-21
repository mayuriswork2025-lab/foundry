"""
Business logic + data access for the milestones module. Raw SQL
(sqlalchemy.text), not the ORM query builder — see modules/auth/permissions.py
for why.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser
from ..auth.permissions import is_admin, is_startup_member, is_startup_mentor
from .models import Milestone, MilestoneCreate, MilestoneNotification, MilestoneStatusUpdate, MilestoneVerification


def list_milestones(db: Session, startup_id: int) -> list[Milestone]:
    rows = db.execute(
        text("select * from milestones where startup_id = :startup_id order by due_date nulls last, milestone_id"),
        {"startup_id": startup_id},
    ).mappings().all()
    return [Milestone.model_validate(dict(row)) for row in rows]


def create_milestone(db: Session, user: CurrentUser, startup_id: int, payload: MilestoneCreate) -> Milestone:
    """Only the mentor guiding this startup (or an admin) can set milestones for it."""
    if not (is_admin(db, user.id) or is_startup_mentor(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Only this startup's mentor can create milestones.")

    existing = db.execute(
        text(
            "select 1 from milestones where startup_id = :startup_id and milestone_name = :milestone_name"
        ),
        {"startup_id": startup_id, "milestone_name": payload.milestone_name},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A milestone with this name already exists.")

    row = db.execute(
        text(
            """
            insert into milestones (startup_id, milestone_name, due_date)
            values (:startup_id, :milestone_name, :due_date)
            returning *
            """
        ),
        {"startup_id": startup_id, "milestone_name": payload.milestone_name, "due_date": payload.due_date},
    ).mappings().first()
    db.commit()

    return Milestone.model_validate(dict(row))


def update_milestone_status(
    db: Session, user: CurrentUser, startup_id: int, milestone_id: int, payload: MilestoneStatusUpdate
) -> Milestone:
    """
    The team actually doing the work moves a milestone along — any accepted
    member of the startup, not just the founder. Moving to 'in_progress' is
    also how a founder dismisses the "new milestone" notification, since
    that banner is driven by status = 'pending'. Moving to 'completed' also
    marks it 'unverified', which is what puts it in front of the mentor for
    sign-off (see verify_milestone()).
    """
    if not (is_admin(db, user.id) or is_startup_member(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Only this startup's team can update its milestones.")

    completion_date = "current_date" if payload.status == "completed" else "null"
    verification_status = "'unverified'" if payload.status == "completed" else "null"
    row = db.execute(
        text(
            f"""
            update milestones
            set status = :status, completion_date = {completion_date}, verification_status = {verification_status}
            where milestone_id = :milestone_id and startup_id = :startup_id and status != 'completed'
            returning *
            """
        ),
        {"status": payload.status, "milestone_id": milestone_id, "startup_id": startup_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=409, detail="This milestone is already completed or doesn't exist.")

    db.commit()
    return Milestone.model_validate(dict(row))


def verify_milestone(
    db: Session, user: CurrentUser, startup_id: int, milestone_id: int, payload: MilestoneVerification
) -> Milestone:
    """Only this startup's mentor signs off on a completed milestone."""
    if not (is_admin(db, user.id) or is_startup_mentor(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Only this startup's mentor can verify milestones.")

    row = db.execute(
        text(
            """
            update milestones
            set verification_status = :verification_status, mentor_remarks = :remarks
            where milestone_id = :milestone_id and startup_id = :startup_id and status = 'completed'
            returning *
            """
        ),
        {
            "verification_status": payload.verification_status,
            "remarks": payload.remarks,
            "milestone_id": milestone_id,
            "startup_id": startup_id,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=409, detail="This milestone isn't completed yet or doesn't exist.")

    db.commit()
    return Milestone.model_validate(dict(row))


def reopen_milestone(db: Session, user: CurrentUser, startup_id: int, milestone_id: int) -> Milestone:
    """
    The mentor's call to undo a completion — moves status back to
    'in_progress', un-verifies it, and clears the completion date, so it
    goes through the same complete -> verify cycle again. mentor_remarks is
    left as-is: a record of why it was reopened, if the mentor left one.
    """
    if not (is_admin(db, user.id) or is_startup_mentor(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Only this startup's mentor can reopen a milestone.")

    row = db.execute(
        text(
            """
            update milestones
            set status = 'in_progress', completion_date = null, verification_status = null
            where milestone_id = :milestone_id and startup_id = :startup_id and status = 'completed'
            returning *
            """
        ),
        {"milestone_id": milestone_id, "startup_id": startup_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=409, detail="This milestone isn't completed, so there's nothing to reopen.")

    db.commit()
    return Milestone.model_validate(dict(row))


def list_notifications(db: Session, user: CurrentUser) -> list[MilestoneNotification]:
    """
    Milestones needing this user's attention, across every startup they're
    an accepted member of: brand new ones (still 'pending', i.e. not yet
    acknowledged), 'in_progress' ones whose due date is close, and
    'completed' ones still 'unverified' — the last of which is what puts a
    milestone in front of the mentor once the team marks it done.
    """
    rows = db.execute(
        text(
            """
            select m.*, s.startup_name
            from milestones m
            join startups s on s.startup_id = m.startup_id
            join startup_memberships sm on sm.startup_id = m.startup_id
            where sm.user_id = :user_id and sm.status = 'accepted'
              and (
                  m.status = 'pending'
                  or (m.status = 'in_progress' and m.due_date is not null and m.due_date <= current_date + 7)
                  or (m.status = 'completed' and m.verification_status = 'unverified')
              )
            order by m.due_date nulls last, m.milestone_id
            """
        ),
        {"user_id": user.id},
    ).mappings().all()
    return [MilestoneNotification.model_validate(dict(row)) for row in rows]
