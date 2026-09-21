"""Pydantic models for the milestones module."""

from __future__ import annotations

import datetime
from typing import Literal

from ...common.model import ApiModel


class Milestone(ApiModel):
    milestone_id: int
    startup_id: int
    milestone_name: str
    due_date: datetime.date | None
    completion_date: datetime.date | None
    status: str | None
    verification_status: str | None
    mentor_remarks: str | None


class MilestoneCreate(ApiModel):
    milestone_name: str
    due_date: datetime.date | None = None


class MilestoneStatusUpdate(ApiModel):
    # Only a forward move onto these two — 'pending' is the starting point,
    # not something you set back to via this endpoint.
    status: Literal["in_progress", "completed"]


class MilestoneVerification(ApiModel):
    verification_status: Literal["verified", "rejected"]
    remarks: str | None = None


class MilestoneNotification(Milestone):
    startup_name: str
