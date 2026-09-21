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
    submitted_at: datetime.datetime | None
    current_stage: str | None
    registered_by: uuid.UUID | None
    member_status: str | None = None


class StartupCreate(ApiModel):
    startup_name: str
    domain: str | None = None
    description: str | None = None


class StartupUpdate(ApiModel):
    startup_name: str
    domain: str | None = None
    description: str | None = None


class InviteMemberRequest(ApiModel):
    email: str
    project_role: str = "member"


class Membership(ApiModel):
    membership_id: int
    startup_id: int
    user_id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    project_role: str
    status: str
    join_date: datetime.date | None
