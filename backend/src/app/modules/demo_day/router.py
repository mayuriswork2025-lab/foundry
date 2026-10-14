"""Routes for the demo_day module. Thin: route -> controller, nothing else."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db.client import get_db
from ..auth.auth import CurrentUser, get_current_user
from . import controller
from .models import DemoDay, DemoDayCreate, Evaluation, EvaluationSubmit

router = APIRouter(prefix="/api/demo-days", tags=["demo-day"])

# Startup-scoped: a founder/teammate joining their own startup into a demo day.
startup_router = APIRouter(prefix="/api/startups/{startup_id}/demo-days", tags=["demo-day"])


@router.get("", response_model=list[DemoDay])
def list_demo_days(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_demo_days(db, user)


@router.post("", response_model=DemoDay)
def create_demo_day(
    payload: DemoDayCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.create_demo_day(db, user, payload)


@router.post("/{demo_day_id}/judges", response_model=DemoDay)
def join_as_judge(
    demo_day_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.join_as_judge(db, user, demo_day_id)


@router.delete("/{demo_day_id}/judges", response_model=DemoDay)
def withdraw_as_judge(
    demo_day_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.withdraw_as_judge(db, user, demo_day_id)


@router.get("/evaluations/mine", response_model=list[Evaluation])
def list_my_evaluations(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.list_my_evaluations(db, user)


@router.patch("/evaluations/{evaluation_id}", response_model=Evaluation)
def submit_evaluation(
    evaluation_id: int,
    payload: EvaluationSubmit,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.submit_evaluation(db, user, evaluation_id, payload)


@startup_router.get("/current", response_model=DemoDay | None)
def get_current_for_startup(
    startup_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.get_current_for_startup(db, user, startup_id)


@startup_router.post("/{demo_day_id}/join", response_model=DemoDay)
def join_startup(
    startup_id: int,
    demo_day_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.join_startup(db, user, startup_id, demo_day_id)


@startup_router.post("/{demo_day_id}/confirm-date", response_model=DemoDay)
def confirm_date(
    startup_id: int,
    demo_day_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return controller.confirm_date(db, user, startup_id, demo_day_id)
