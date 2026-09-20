import os
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. Copy .env.example to .env and fill it in "
        "(the token issuer's signing secret — e.g. Supabase's Project Settings -> API "
        "-> JWT Settings -> JWT Secret, if that's what's issuing your JWTs)."
    )


@dataclass
class CurrentUser:
    id: str
    email: str | None


def get_current_user(request: Request) -> CurrentUser:
    """
    FastAPI dependency: verifies the caller's JWT locally (HS256, signed with
    JWT_SECRET) — no network call to whatever issued it (Supabase Auth, by
    default in this project).

    Trade-off: a session the issuer has revoked (sign-out, ban) still passes
    here until the JWT's own expiry, since nothing checks back with it.
    """
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    token = header[len("Bearer ") :] if header and header.startswith("Bearer ") else None

    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], audience="authenticated")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing subject.")

    return CurrentUser(id=user_id, email=payload.get("email"))


CurrentUserDep = Depends(get_current_user)
