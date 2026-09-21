"""Routes for the startups module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser, get_current_user
from ..auth.permissions import require_admin_or_startup_member
from ...db.client import get_db
from . import controller
from .models import InviteMemberRequest, Membership, Startup, StartupCreate, StartupUpdate

router = APIRouter(prefix="/api/startups", tags=["startups"])


@router.get("", response_model=list[Startup])
def list_startups(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_startups(db, user)


@router.post("", response_model=Startup)
def create_startup(
    payload: StartupCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.create_startup(db, user, payload)


@router.get("/guiding", response_model=list[Startup])
def list_guiding_startups(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Startups this user is a member of — for a mentor, the ones they've approved."""
    return controller.list_startups_for_member(db, user.id)


@router.patch("/{startup_id}", response_model=Startup)
def update_startup(
    startup_id: int,
    payload: StartupUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.update_startup(db, user, startup_id, payload)


@router.patch("/{startup_id}/submit", response_model=Startup)
def submit_startup(
    startup_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.submit_startup(db, user, startup_id)


@router.patch("/{startup_id}/approve", response_model=Startup)
def approve_startup(
    startup_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.approve_startup(db, user, startup_id)


@router.get("/{startup_id}/members", response_model=list[Membership])
def list_members(
    startup_id: int,
    user: CurrentUser = Depends(require_admin_or_startup_member),
    db: Session = Depends(get_db),
):
    return controller.list_members(db, user, startup_id)


@router.post("/{startup_id}/members", response_model=Membership)
def invite_member(
    startup_id: int,
    payload: InviteMemberRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.invite_member(db, user, startup_id, payload)


@router.post("/{startup_id}/members/accept", response_model=Membership)
def accept_invite(
    startup_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.accept_invite(db, user, startup_id)
