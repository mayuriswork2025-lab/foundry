import datetime
import os
from dataclasses import dataclass

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. Copy .env.example to .env and fill it in — any random "
        "string for local dev, e.g. `openssl rand -hex 32`."
    )

ACCESS_TOKEN_EXPIRES_SECONDS = 3600


@dataclass
class CurrentUser:
    id: str
    email: str | None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    """Mints a JWT for a user who just signed up or logged in successfully."""
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + datetime.timedelta(seconds=ACCESS_TOKEN_EXPIRES_SECONDS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(request: Request) -> CurrentUser:
    """
    FastAPI dependency: verifies the caller's JWT locally (HS256, signed with
    JWT_SECRET) — the same secret create_access_token() signs with, since
    this backend issues its own tokens now.
    """
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    token = header[len("Bearer ") :] if header and header.startswith("Bearer ") else None

    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing subject.")

    return CurrentUser(id=user_id, email=payload.get("email"))


CurrentUserDep = Depends(get_current_user)
