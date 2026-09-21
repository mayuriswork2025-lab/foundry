"""
App assembly only. Each business function (startups, and whatever comes next —
mentoring, funding, milestones, demo days) lives under modules/<name>/ with
its own models.py (Pydantic shapes), controller.py (business logic + raw SQL
data access), and router.py (thin route -> controller mapping) — mounted
here, not defined here.
"""

import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db.client import get_db
from .modules.auth.router import router as auth_router
from .modules.mentoring.router import router as mentoring_router
from .modules.milestones.router import notifications_router as milestone_notifications_router
from .modules.milestones.router import router as milestones_router
from .modules.startups.router import router as startups_router
from .modules.users.router import router as users_router

logger = logging.getLogger("app")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catches anything a controller didn't deliberately raise as an
    HTTPException (those still get FastAPI's own handler, untouched here) —
    a DB error, a bug, whatever — and turns it into a clean 500 instead of
    a leaked traceback or an unhandled crash.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    """Used by uptime monitors/deploy platforms — 503s if the DB is unreachable."""
    try:
        db.execute(text("select 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unreachable") from exc
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(mentoring_router)
app.include_router(milestones_router)
app.include_router(milestone_notifications_router)
app.include_router(startups_router)
app.include_router(users_router)
