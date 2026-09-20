"""Routes for the startups module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser, get_current_user
from ...db.client import get_db
from . import controller
from .models import Startup, StartupCreate

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
