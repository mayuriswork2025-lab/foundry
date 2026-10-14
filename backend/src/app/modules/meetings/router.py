"""Routes for the meetings module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser, get_current_user
from ...db.client import get_db
from . import controller
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

router = APIRouter(prefix="/api/milestones/{milestone_id}/meetings", tags=["meetings"])


@router.get("", response_model=list[Meeting])
def list_meetings(
    milestone_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_meetings(db, user, milestone_id)


@router.post("", response_model=Meeting)
def create_meeting(
    milestone_id: int,
    payload: MeetingCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.create_meeting(db, user, milestone_id, payload)


@router.patch("/{meeting_id}", response_model=Meeting)
def update_meeting(
    milestone_id: int,
    meeting_id: int,
    payload: MeetingUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.update_meeting(db, user, milestone_id, meeting_id, payload)


@router.post("/{meeting_id}/action-items", response_model=ActionItem)
def add_action_item(
    milestone_id: int,
    meeting_id: int,
    payload: ActionItemCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.add_action_item(db, user, milestone_id, meeting_id, payload)


@router.patch("/{meeting_id}/action-items/{action_item_id}", response_model=ActionItem)
def update_action_item(
    milestone_id: int,
    meeting_id: int,
    action_item_id: int,
    payload: ActionItemUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.update_action_item(db, user, milestone_id, meeting_id, action_item_id, payload)


@router.post("/{meeting_id}/comments", response_model=Comment)
def add_comment(
    milestone_id: int,
    meeting_id: int,
    payload: CommentCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.add_comment(db, user, milestone_id, meeting_id, payload)
