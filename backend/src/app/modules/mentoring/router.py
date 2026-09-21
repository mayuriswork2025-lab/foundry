"""Routes for the mentoring module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser, get_current_user
from ...db.client import get_db
from . import controller
from .models import MentorRequest, MentorRequestCreate, MentorRequestDecision

router = APIRouter(tags=["mentoring"])


@router.post("/api/startups/{startup_id}/mentor-requests", response_model=MentorRequest)
def create_mentor_request(
    startup_id: int,
    payload: MentorRequestCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.create_mentor_request(db, user, startup_id, payload)


@router.get("/api/mentor-requests/inbox", response_model=list[MentorRequest])
def list_inbox(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_inbox(db, user)


@router.patch("/api/mentor-requests/{request_id}/approve", response_model=MentorRequest)
def approve_request(
    request_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.approve_request(db, user, request_id)


@router.patch("/api/mentor-requests/{request_id}/reject", response_model=MentorRequest)
def reject_request(
    request_id: int,
    payload: MentorRequestDecision,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.reject_request(db, user, request_id, payload)
