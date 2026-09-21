"""Pydantic models for the users module."""

from __future__ import annotations

import uuid

from ...common.model import ApiModel


class UserSummary(ApiModel):
    user_id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    department: str | None = None
