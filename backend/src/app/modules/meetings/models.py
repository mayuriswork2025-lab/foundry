"""Pydantic models for the meetings module (meetings, action items, comments)."""

from __future__ import annotations

import datetime
import uuid
from typing import Literal

from ...common.model import ApiModel


class ActionItem(ApiModel):
    action_item_id: int
    meeting_id: int
    item_text: str
    is_done: bool
    created_at: datetime.datetime


class ActionItemCreate(ApiModel):
    item_text: str


class ActionItemUpdate(ApiModel):
    is_done: bool


class Comment(ApiModel):
    comment_id: int
    meeting_id: int
    user_id: uuid.UUID
    author_first_name: str
    author_last_name: str
    body: str
    created_at: datetime.datetime


class CommentCreate(ApiModel):
    body: str


class MeetingCreate(ApiModel):
    scheduled_at: datetime.datetime
    agenda: str | None = None


class MeetingUpdate(ApiModel):
    scheduled_at: datetime.datetime | None = None
    agenda: str | None = None
    discussion: str | None = None
    status: Literal["scheduled", "completed", "cancelled"] | None = None


class Meeting(ApiModel):
    meeting_id: int
    milestone_id: int
    scheduled_by: uuid.UUID
    scheduled_at: datetime.datetime
    agenda: str | None
    discussion: str | None
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    action_items: list[ActionItem] = []
    comments: list[Comment] = []
