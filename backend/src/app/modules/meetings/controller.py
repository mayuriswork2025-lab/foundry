"""
Business logic + data access for the meetings module. Raw SQL
(sqlalchemy.text), not the ORM query builder — see modules/auth/permissions.py
for why.

Scheduling a meeting is mentee-only (founder/teammate, not the mentor —
simpler design, per the product call). Everything else — updating it,
checking off action items, commenting — is open to any accepted member of
the startup, mentor included.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser
from ..auth.permissions import is_admin, is_startup_member, is_startup_mentee
from .models import (
    ActionItem,
    ActionItemCreate,
    ActionItemUpdate,
    Comment,
    CommentCreate,
    Meeting,
    MeetingCreate,
    MeetingUpdate,
)


def _milestone_startup_id(db: Session, milestone_id: int) -> int | None:
    row = db.execute(
        text("select startup_id from milestones where milestone_id = :milestone_id"),
        {"milestone_id": milestone_id},
    ).first()
    return row[0] if row else None


def _require_member(db: Session, user: CurrentUser, startup_id: int) -> None:
    if not (is_admin(db, user.id) or is_startup_member(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Not a member of this startup.")


def create_meeting(db: Session, user: CurrentUser, milestone_id: int, payload: MeetingCreate) -> Meeting:
    startup_id = _milestone_startup_id(db, milestone_id)
    if startup_id is None:
        raise HTTPException(status_code=404, detail="This milestone doesn't exist.")
    if not (is_admin(db, user.id) or is_startup_mentee(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Only this startup's team can schedule a meeting.")

    row = db.execute(
        text(
            """
            insert into meetings (milestone_id, scheduled_by, scheduled_at, agenda)
            values (:milestone_id, :scheduled_by, :scheduled_at, :agenda)
            returning meeting_id
            """
        ),
        {
            "milestone_id": milestone_id,
            "scheduled_by": user.id,
            "scheduled_at": payload.scheduled_at,
            "agenda": payload.agenda,
        },
    ).first()

    # Scheduling a meeting answers the mentor's "let's meet" nudge, if there was one.
    db.execute(
        text("update milestones set meeting_requested_at = null where milestone_id = :milestone_id"),
        {"milestone_id": milestone_id},
    )
    db.commit()

    return _meeting_with_children(db, row[0])


def list_meetings(db: Session, user: CurrentUser, milestone_id: int) -> list[Meeting]:
    startup_id = _milestone_startup_id(db, milestone_id)
    if startup_id is None:
        raise HTTPException(status_code=404, detail="This milestone doesn't exist.")
    _require_member(db, user, startup_id)

    rows = db.execute(
        text("select meeting_id from meetings where milestone_id = :milestone_id order by scheduled_at desc"),
        {"milestone_id": milestone_id},
    ).all()
    return [_meeting_with_children(db, row[0]) for row in rows]


def update_meeting(db: Session, user: CurrentUser, milestone_id: int, meeting_id: int, payload: MeetingUpdate) -> Meeting:
    startup_id = _milestone_startup_id(db, milestone_id)
    if startup_id is None:
        raise HTTPException(status_code=404, detail="This milestone doesn't exist.")
    _require_member(db, user, startup_id)

    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    set_clause = ", ".join(f"{key} = :{key}" for key in fields)
    row = db.execute(
        text(
            f"""
            update meetings
            set {set_clause}, updated_at = now()
            where meeting_id = :meeting_id and milestone_id = :milestone_id
            returning meeting_id
            """
        ),
        {**fields, "meeting_id": meeting_id, "milestone_id": milestone_id},
    ).first()

    if row is None:
        raise HTTPException(status_code=404, detail="This meeting doesn't exist.")

    db.commit()
    return _meeting_with_children(db, row[0])


def add_action_item(
    db: Session, user: CurrentUser, milestone_id: int, meeting_id: int, payload: ActionItemCreate
) -> ActionItem:
    startup_id = _milestone_startup_id(db, milestone_id)
    if startup_id is None:
        raise HTTPException(status_code=404, detail="This milestone doesn't exist.")
    _require_member(db, user, startup_id)

    row = db.execute(
        text(
            """
            insert into meeting_action_items (meeting_id, item_text)
            values (:meeting_id, :item_text)
            returning *
            """
        ),
        {"meeting_id": meeting_id, "item_text": payload.item_text},
    ).mappings().first()
    db.commit()

    return ActionItem.model_validate(dict(row))


def update_action_item(
    db: Session,
    user: CurrentUser,
    milestone_id: int,
    meeting_id: int,
    action_item_id: int,
    payload: ActionItemUpdate,
) -> ActionItem:
    startup_id = _milestone_startup_id(db, milestone_id)
    if startup_id is None:
        raise HTTPException(status_code=404, detail="This milestone doesn't exist.")
    _require_member(db, user, startup_id)

    row = db.execute(
        text(
            """
            update meeting_action_items
            set is_done = :is_done
            where action_item_id = :action_item_id and meeting_id = :meeting_id
            returning *
            """
        ),
        {"is_done": payload.is_done, "action_item_id": action_item_id, "meeting_id": meeting_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="This action item doesn't exist.")

    db.commit()
    return ActionItem.model_validate(dict(row))


def add_comment(db: Session, user: CurrentUser, milestone_id: int, meeting_id: int, payload: CommentCreate) -> Comment:
    startup_id = _milestone_startup_id(db, milestone_id)
    if startup_id is None:
        raise HTTPException(status_code=404, detail="This milestone doesn't exist.")
    _require_member(db, user, startup_id)

    row = db.execute(
        text(
            """
            insert into meeting_comments (meeting_id, user_id, body)
            values (:meeting_id, :user_id, :body)
            returning comment_id
            """
        ),
        {"meeting_id": meeting_id, "user_id": user.id, "body": payload.body},
    ).first()
    db.commit()

    return _comment_with_author(db, row[0])


def _meeting_with_children(db: Session, meeting_id: int) -> Meeting:
    row = db.execute(
        text("select * from meetings where meeting_id = :meeting_id"),
        {"meeting_id": meeting_id},
    ).mappings().first()

    action_item_rows = db.execute(
        text("select * from meeting_action_items where meeting_id = :meeting_id order by created_at"),
        {"meeting_id": meeting_id},
    ).mappings().all()

    comment_rows = db.execute(
        text(
            """
            select c.*, u.first_name as author_first_name, u.last_name as author_last_name
            from meeting_comments c
            join users u on u.user_id = c.user_id
            where c.meeting_id = :meeting_id
            order by c.created_at
            """
        ),
        {"meeting_id": meeting_id},
    ).mappings().all()

    return Meeting.model_validate(
        {
            **dict(row),
            "action_items": [dict(r) for r in action_item_rows],
            "comments": [dict(r) for r in comment_rows],
        }
    )


def _comment_with_author(db: Session, comment_id: int) -> Comment:
    row = db.execute(
        text(
            """
            select c.*, u.first_name as author_first_name, u.last_name as author_last_name
            from meeting_comments c
            join users u on u.user_id = c.user_id
            where c.comment_id = :comment_id
            """
        ),
        {"comment_id": comment_id},
    ).mappings().first()
    return Comment.model_validate(dict(row))
