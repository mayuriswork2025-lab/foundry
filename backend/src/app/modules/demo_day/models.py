"""Pydantic models for the demo_day module."""

from __future__ import annotations

import datetime
import uuid
from typing import Literal

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
