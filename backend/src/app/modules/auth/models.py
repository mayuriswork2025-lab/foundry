"""Pydantic models for the auth module."""

from __future__ import annotations

import uuid
from typing import Literal

from ...common.model import ApiModel

# Admin/judge are deliberately excluded — those roles are assigned by an
# admin, not self-selected at signup.
SelfSelectableRole = Literal["founder", "mentor"]


class SignupRequest(ApiModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: SelfSelectableRole
    phone: str | None = None
    department: str | None = None


class LoginRequest(ApiModel):
    email: str
    password: str


class UserProfile(ApiModel):
    user_id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    role_name: str
    status: str


class AuthResponse(ApiModel):
    access_token: str
    user: UserProfile
