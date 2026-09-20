"""
Pydantic models for the startups feature. Not a mirror of the `startups`
table's full DDL — db/migrations/*.sql is the one definition of that; this is
just the shape this feature's endpoints accept/return.
"""

from __future__ import annotations

import datetime
import uuid

from ...common.model import ApiModel


class Startup(ApiModel):
    startup_id: int
    startup_name: str
    domain: str | None
    description: str | None
    registration_date: datetime.date | None
    registration_status: str | None
    current_stage: str | None
    registered_by: uuid.UUID | None


class StartupCreate(ApiModel):
    startup_name: str
    domain: str | None = None
    description: str | None = None
    current_stage: str | None = None


class StartupUpdate(ApiModel):
    """All fields optional — only the ones provided are updated (PATCH semantics)."""

    startup_name: str | None = None
    domain: str | None = None
    description: str | None = None
    registration_status: str | None = None
    current_stage: str | None = None


class StartupStageCount(ApiModel):
    """One row of the `GROUP BY current_stage` aggregate query."""

    current_stage: str | None
    startup_count: int


class StartupMilestoneInsight(ApiModel):
    """A startup whose milestone count is above the average across all startups (nested query)."""

    startup_id: int
    startup_name: str
    milestone_count: int
