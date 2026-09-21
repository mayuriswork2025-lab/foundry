"""
App assembly only. Each business function (startups, and whatever comes next —
mentoring, funding, milestones, demo days) lives under modules/<name>/ with
its own models.py (Pydantic shapes), controller.py (business logic + raw SQL
data access), and router.py (thin route -> controller mapping) — mounted
here, not defined here.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/api/hello")
def hello():
    return {"message": "Hello, world!"}


app.include_router(auth_router)
app.include_router(mentoring_router)
app.include_router(milestones_router)
app.include_router(milestone_notifications_router)
app.include_router(startups_router)
app.include_router(users_router)
