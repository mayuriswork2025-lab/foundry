"""
App assembly only. Each business function (startups, and whatever comes next —
mentoring, funding, milestones, demo days) lives under modules/<name>/ with
its own models.py (Pydantic shapes), controller.py (business logic + raw SQL
data access), and router.py (thin route -> controller mapping) — mounted
here, not defined here.
"""

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db.client import get_db
from .modules.auth.router import router as auth_router
from .modules.mentoring.router import router as mentoring_router
from .modules.milestones.router import notifications_router as milestone_notifications_router
from .modules.milestones.router import router as milestones_router
from .modules.startups.router import router as startups_router
from .modules.users.router import router as users_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
