"""Pydantic models for the demo_day module."""

from __future__ import annotations

import datetime
import uuid
from typing import Literal

from pydantic import Field

from ...common.model import ApiModel


class JudgeSummary(ApiModel):
    mentor_id: uuid.UUID
    first_name: str
    last_name: str


class DemoDay(ApiModel):
    demo_day_id: int
    event_name: str
    event_date: datetime.date
    venue: str | None
    theme: str | None
    kind: Literal["monthly", "special"]
    # Everyone who's signed up to judge this demo day in general.
    judges: list[JudgeSummary]
    # Whether the requesting user (if a mentor) is already signed up to judge
    # this one — drives the sign-up/withdraw toggle on the mentor's tab.
    am_judging: bool
    # The judge(s) actually assigned (round-robin) to evaluate a specific
    # startup — only populated in startup-scoped responses; empty otherwise.
    assigned_judges: list[JudgeSummary]
    # Whether the startup's team has confirmed the date — only meaningful in
    # startup-scoped responses; null otherwise.
    date_confirmed_at: datetime.datetime | None


class DemoDayCreate(ApiModel):
    event_name: str
    event_date: datetime.date
    venue: str | None = None
    theme: str | None = None


class Evaluation(ApiModel):
    """A judge's score sheet for one startup — scores stay null until submitted."""

    evaluation_id: int
    demo_day_id: int
    event_name: str
    event_date: datetime.date
    startup_id: int
    startup_name: str
    innovation_score: float | None
    technical_score: float | None
    business_score: float | None
    presentation_score: float | None
    overall_remarks: str | None


class EvaluationSubmit(ApiModel):
    innovation_score: float = Field(ge=0, le=10)
    technical_score: float = Field(ge=0, le=10)
    business_score: float = Field(ge=0, le=10)
    presentation_score: float = Field(ge=0, le=10)
    overall_remarks: str | None = None
