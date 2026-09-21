"""
Business logic + data access for the mentoring module. This is the explicit,
mentee-initiated counterpart to startups.approve_startup() — a founder posts
a request, and any mentor can pick it up from their inbox.

Approving here writes to two places: mentor_assignments (tied to the
mentor_request_id) is the authoritative record of this specific request
being approved, with its own active/completed/cancelled lifecycle;
startup_memberships gets the same 'mentor' row approve_startup() writes,
so is_startup_mentor()/milestones, the Team list, and "Guiding Startups" —
all of which read startup_memberships, not mentor_assignments — keep
working the same regardless of which approval path got a startup mentored.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser
from ..auth.permissions import get_current_user_role, is_startup_founder
from .models import MentorRequest, MentorRequestCreate, MentorRequestDecision


def create_mentor_request(
    db: Session, user: CurrentUser, startup_id: int, payload: MentorRequestCreate
) -> MentorRequest:
    """Only this startup's founder may ask for a mentor, and only once it's been submitted."""
    if not is_startup_founder(db, user.id, startup_id):
        raise HTTPException(status_code=403, detail="Only the founder can request a mentor for this idea.")

    startup = db.execute(
        text("select registration_status from startups where startup_id = :startup_id"),
        {"startup_id": startup_id},
    ).first()
    if startup is None:
        raise HTTPException(status_code=404, detail="This idea doesn't exist.")
    if startup[0] != "pending":
        raise HTTPException(status_code=409, detail="This idea needs to be submitted and pending review first.")

    row = db.execute(
        text(
            """
            insert into mentor_requests (startup_id, requested_by, required_skills, request_description)
            values (:startup_id, :requested_by, :required_skills, :request_description)
            returning mentor_request_id
            """
        ),
        {
            "startup_id": startup_id,
            "requested_by": user.id,
            "required_skills": payload.required_skills,
            "request_description": payload.request_description,
        },
    ).first()
    mentor_request_id = row[0]

    if payload.mentor_ids:
        # Only actual mentors can be targeted (the up-to-3 cap is already
        # enforced by MentorRequestCreate's max_length) — filters out
        # anything a tampered client might send.
        db.execute(
            text(
                """
                insert into mentor_request_targets (mentor_request_id, mentor_id)
                select :mentor_request_id, u.user_id
                from users u
                join roles r on r.role_id = u.role_id
                where r.role_name = 'mentor' and u.user_id = any(cast(:mentor_ids as uuid[]))
                """
            ),
            {"mentor_request_id": mentor_request_id, "mentor_ids": [str(m) for m in payload.mentor_ids]},
        )

    db.commit()

    return _mentor_request_with_details(db, mentor_request_id)


def list_inbox(db: Session, user: CurrentUser) -> list[MentorRequest]:
    """
    Every pending mentor request this mentor can see: untargeted (broadcast)
    requests, plus any request that specifically picked them.
    """
    role = get_current_user_role(db, user.id)
    if role not in ("mentor", "admin"):
        raise HTTPException(status_code=403, detail="Only a mentor can view the request inbox.")

    rows = db.execute(
        text(
            """
            select mr.*, s.startup_name, u.first_name as requester_first_name, u.last_name as requester_last_name,
                   (
                       select coalesce(array_agg(t.mentor_id), '{}')
                       from mentor_request_targets t
                       where t.mentor_request_id = mr.mentor_request_id
                   ) as mentor_ids
            from mentor_requests mr
            join startups s on s.startup_id = mr.startup_id
            join users u on u.user_id = mr.requested_by
            where mr.status = 'pending'
              and (
                  not exists (
                      select 1 from mentor_request_targets t where t.mentor_request_id = mr.mentor_request_id
                  )
                  or exists (
                      select 1 from mentor_request_targets t
                      where t.mentor_request_id = mr.mentor_request_id and t.mentor_id = :mentor_id
                  )
              )
            order by mr.created_at
            """
        ),
        {"mentor_id": user.id},
    ).mappings().all()
    return [MentorRequest.model_validate(dict(row)) for row in rows]


def approve_request(db: Session, user: CurrentUser, request_id: int) -> MentorRequest:
    role = get_current_user_role(db, user.id)
    if role not in ("mentor", "admin"):
        raise HTTPException(status_code=403, detail="Only a mentor can decide on a mentor request.")

    request_row = db.execute(
        text("select startup_id from mentor_requests where mentor_request_id = :id and status = 'pending'"),
        {"id": request_id},
    ).first()
    if request_row is None:
        raise HTTPException(status_code=409, detail="This request has already been decided or doesn't exist.")
    startup_id = request_row[0]

    startup = db.execute(
        text("select registration_status from startups where startup_id = :startup_id"),
        {"startup_id": startup_id},
    ).first()
    if startup is None or startup[0] != "pending":
        raise HTTPException(status_code=409, detail="This idea already has a mentor or isn't pending review.")

    db.execute(
        text(
            """
            update mentor_requests
            set status = 'approved', decided_by = :mentor_id, decision_date = current_date
            where mentor_request_id = :id
            """
        ),
        {"id": request_id, "mentor_id": user.id},
    )
    db.execute(
        text("update startups set registration_status = 'approved' where startup_id = :startup_id"),
        {"startup_id": startup_id},
    )
    db.execute(
        text(
            """
            insert into mentor_assignments (mentor_request_id, mentor_id)
            values (:mentor_request_id, :mentor_id)
            on conflict (mentor_request_id, mentor_id) do nothing
            """
        ),
        {"mentor_request_id": request_id, "mentor_id": user.id},
    )
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

    return _mentor_request_with_details(db, request_id)


def reject_request(db: Session, user: CurrentUser, request_id: int, payload: MentorRequestDecision) -> MentorRequest:
    role = get_current_user_role(db, user.id)
    if role not in ("mentor", "admin"):
        raise HTTPException(status_code=403, detail="Only a mentor can decide on a mentor request.")

    row = db.execute(
        text(
            """
            update mentor_requests
            set status = 'rejected', decided_by = :mentor_id, decision_date = current_date, remarks = :remarks
            where mentor_request_id = :id and status = 'pending'
            returning mentor_request_id
            """
        ),
        {"id": request_id, "mentor_id": user.id, "remarks": payload.remarks},
    ).first()
    if row is None:
        raise HTTPException(status_code=409, detail="This request has already been decided or doesn't exist.")

    db.commit()
    return _mentor_request_with_details(db, request_id)


def _mentor_request_with_details(db: Session, mentor_request_id: int) -> MentorRequest:
    row = db.execute(
        text(
            """
            select mr.*, s.startup_name, u.first_name as requester_first_name, u.last_name as requester_last_name,
                   (
                       select coalesce(array_agg(t.mentor_id), '{}')
                       from mentor_request_targets t
                       where t.mentor_request_id = mr.mentor_request_id
                   ) as mentor_ids
            from mentor_requests mr
            join startups s on s.startup_id = mr.startup_id
            join users u on u.user_id = mr.requested_by
            where mr.mentor_request_id = :id
            """
        ),
        {"id": mentor_request_id},
    ).mappings().first()
    return MentorRequest.model_validate(dict(row))
