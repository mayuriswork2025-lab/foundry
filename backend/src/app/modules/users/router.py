"""Routes for the users module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser, get_current_user
from ...db.client import get_db
from . import controller
from .models import UserSummary

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/search", response_model=list[UserSummary])
def search_founders(
    q: str = "",
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.search_founders(db, user, q)


@router.get("/mentors", response_model=list[UserSummary])
def list_suggested_mentors(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_suggested_mentors(db)
