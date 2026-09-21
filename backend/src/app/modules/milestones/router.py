"""Routes for the milestones module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser, get_current_user
from ..auth.permissions import require_admin_or_startup_member
from ...db.client import get_db
from . import controller
from .models import Milestone, MilestoneCreate, MilestoneNotification, MilestoneStatusUpdate, MilestoneVerification

router = APIRouter(prefix="/api/startups/{startup_id}/milestones", tags=["milestones"])

# Cross-startup, so it can't live under the /api/startups/{startup_id} prefix above.
notifications_router = APIRouter(prefix="/api/milestones", tags=["milestones"])


@router.get("", response_model=list[Milestone])
def list_milestones(
    startup_id: int,
    user: CurrentUser = Depends(require_admin_or_startup_member),
    db: Session = Depends(get_db),
):
    return controller.list_milestones(db, startup_id)


@router.post("", response_model=Milestone)
def create_milestone(
    startup_id: int,
    payload: MilestoneCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.create_milestone(db, user, startup_id, payload)


@router.patch("/{milestone_id}", response_model=Milestone)
def update_milestone_status(
    startup_id: int,
    milestone_id: int,
    payload: MilestoneStatusUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.update_milestone_status(db, user, startup_id, milestone_id, payload)


@router.patch("/{milestone_id}/verify", response_model=Milestone)
def verify_milestone(
    startup_id: int,
    milestone_id: int,
    payload: MilestoneVerification,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.verify_milestone(db, user, startup_id, milestone_id, payload)


@router.patch("/{milestone_id}/reopen", response_model=Milestone)
def reopen_milestone(
    startup_id: int,
    milestone_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.reopen_milestone(db, user, startup_id, milestone_id)


@notifications_router.get("/notifications", response_model=list[MilestoneNotification])
def list_notifications(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_notifications(db, user)
