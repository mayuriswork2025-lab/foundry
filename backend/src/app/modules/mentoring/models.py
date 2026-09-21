"""Pydantic models for the mentoring module (mentor_requests)."""

from __future__ import annotations

import datetime
import uuid

from pydantic import Field

from ...common.model import ApiModel


class MentorRequestCreate(ApiModel):
    required_skills: str | None = None
    request_description: str | None = None
    # Ticked mentors from the "Suggested Mentors" list, up to 3. Empty falls
    # back to a broadcast visible to every mentor's inbox.
    mentor_ids: list[uuid.UUID] = Field(default_factory=list, max_length=3)


class MentorRequestDecision(ApiModel):
    remarks: str | None = None


class MentorRequest(ApiModel):
    mentor_request_id: int
    startup_id: int
    requested_by: uuid.UUID
    required_skills: str | None
    request_description: str | None
    status: str
    decided_by: uuid.UUID | None
    decision_date: datetime.date | None
    remarks: str | None
    created_at: datetime.datetime
    mentor_ids: list[uuid.UUID]

    # Joined in for the mentor's inbox / the founder's own request list, so
    # neither side needs a second round-trip to show who/what this is about.
    startup_name: str
    requester_first_name: str
    requester_last_name: str
