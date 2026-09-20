"""
Business logic + data access for the auth module. Raw SQL, not the ORM query
builder — same reasoning as every other module here.

Signup is two steps, split across frontend and backend on purpose:
1. Frontend calls supabase.auth.signUp() directly — that's what creates the
   auth.users row and issues the JWT. This backend never talks to Supabase's
   Auth API.
2. Frontend then calls complete_signup() (via POST /api/auth/signup) with
   that fresh JWT, which creates the `users` profile row here — the backend
   is the only thing with DB access, so it has to be the one to do this.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .auth import CurrentUser
from .models import SignupRequest, UserProfile


def complete_signup(db: Session, user: CurrentUser, payload: SignupRequest) -> UserProfile:
    existing = db.execute(
        text("select 1 from users where user_id = :user_id"),
        {"user_id": user.id},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Profile already exists for this account.")

    role_row = db.execute(
        text("select role_id from roles where role_name = :role_name"),
        {"role_name": payload.role},
    ).first()
    if role_row is None:
        raise HTTPException(status_code=400, detail=f"Unknown role: {payload.role}")

    db.execute(
        text(
            """
            insert into users (user_id, role_id, first_name, last_name, email, department)
            values (:user_id, :role_id, :first_name, :last_name, :email, :department)
            """
        ),
        {
            "user_id": user.id,
            "role_id": role_row[0],
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "email": user.email,
            "department": payload.department,
        },
    )
    db.commit()

    return get_profile(db, user)


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
        {"user_id": user.id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="No profile found for this account yet.")

    return UserProfile.model_validate(dict(row))
