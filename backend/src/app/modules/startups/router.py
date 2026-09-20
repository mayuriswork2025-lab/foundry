"""Routes for the startups module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser, get_current_user
from ..auth.permissions import require_admin_or_startup_founder, require_admin_or_startup_member
from ...db.client import get_db
from . import controller
from .models import (
    Startup,
    StartupCreate,
    StartupMilestoneInsight,
    StartupStageCount,
    StartupUpdate,
)

router = APIRouter(prefix="/api/startups", tags=["startups"])


@router.get("", response_model=list[Startup])
def list_startups(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_startups(db, user)


@router.post("", response_model=Startup, status_code=201)
def create_startup(
    payload: StartupCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Any authenticated caller may register a startup — they become its founder member."""
    return controller.create_startup(db, user, payload)


# Static sub-paths first — they'd otherwise be swallowed by "/{startup_id}" below.


@router.get("/stats", response_model=list[StartupStageCount])
def get_startup_stage_counts(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate query: startup count per current_stage."""
    return controller.get_stage_counts(db, user)


@router.get("/insights/above-average-milestones", response_model=list[StartupMilestoneInsight])
def get_startups_above_average_milestones(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Nested query: startups with more milestones than the average startup."""
    return controller.get_above_average_milestone_startups(db, user)


@router.patch("/{startup_id}", response_model=Startup)
def update_startup(
    startup_id: int,
    payload: StartupUpdate,
    user: CurrentUser = Depends(require_admin_or_startup_member),
    db: Session = Depends(get_db),
):
    return controller.update_startup(db, startup_id, payload)


@router.delete("/{startup_id}", status_code=204)
def delete_startup(
    startup_id: int,
    user: CurrentUser = Depends(require_admin_or_startup_founder),
    db: Session = Depends(get_db),
):
    controller.delete_startup(db, startup_id)
