"""
Business logic + data access for the auth module. Raw SQL, not the ORM query
builder — same reasoning as every other module here.

This backend owns credentials outright now: signup hashes and stores the
password, login verifies it and mints a JWT (see auth.py). No external auth
provider is involved — Supabase is purely the Postgres database.
"""

from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .auth import CurrentUser, create_access_token, hash_password, verify_password
from .models import AuthResponse, LoginRequest, SignupRequest, UserProfile


def signup(db: Session, payload: SignupRequest) -> AuthResponse:
    existing = db.execute(
        text("select 1 from users where email = :email"),
        {"email": payload.email},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    role_row = db.execute(
        text("select role_id from roles where role_name = :role_name"),
        {"role_name": payload.role},
    ).first()
    if role_row is None:
        raise HTTPException(status_code=400, detail=f"Unknown role: {payload.role}")

    row = db.execute(
        text(
            """
            insert into users (role_id, first_name, last_name, email, phone, department, password_hash)
            values (:role_id, :first_name, :last_name, :email, :phone, :department, :password_hash)
            returning user_id, first_name, last_name, email, status
            """
        ),
        {
            "role_id": role_row[0],
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "email": payload.email,
            # phone is UNIQUE in the DB — normalize blank to NULL so multiple
            # signups without a phone number don't collide on "".
            "phone": payload.phone or None,
            "department": payload.department,
            "password_hash": hash_password(payload.password),
        },
    ).mappings().first()
    db.commit()

    token = create_access_token(user_id=str(row["user_id"]), email=row["email"])
    profile = UserProfile(**dict(row), role_name=payload.role)
    return AuthResponse(access_token=token, user=profile)


def login(db: Session, payload: LoginRequest) -> AuthResponse:
    row = db.execute(
        text(
            """
            select u.user_id, u.first_name, u.last_name, u.email, u.status, u.password_hash, r.role_name
            from users u
            join roles r on r.role_id = u.role_id
            where u.email = :email
            """
        ),
        {"email": payload.email},
    ).mappings().first()

    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(user_id=str(row["user_id"]), email=row["email"])
    profile = UserProfile(**{k: v for k, v in dict(row).items() if k != "password_hash"})
    return AuthResponse(access_token=token, user=profile)


def get_profile(db: Session, user: CurrentUser) -> UserProfile:
    row = db.execute(
        text(
            """
            select u.user_id, u.first_name, u.last_name, u.email, r.role_name, u.status
            from users u
            join roles r on r.role_id = u.role_id
            where u.user_id = :user_id
            """
        ),
        {"user_id": uuid.UUID(user.id)},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="No profile found for this account.")

    return UserProfile.model_validate(dict(row))
