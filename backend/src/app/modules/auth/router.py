"""Routes for the auth module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db.client import get_db
from . import controller
from .auth import CurrentUser, get_current_user
from .models import AuthResponse, LoginRequest, SignupRequest, UserProfile

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    return controller.signup(db, payload)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return controller.login(db, payload)


@router.get("/me", response_model=UserProfile)
def me(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.get_profile(db, user)
