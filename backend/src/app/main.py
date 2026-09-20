"""
App assembly only. Each business function (startups, and whatever comes next —
mentoring, funding, milestones, demo days) lives under modules/<name>/ with
its own models.py (Pydantic shapes), controller.py (business logic + raw SQL
data access), and router.py (thin route -> controller mapping) — mounted
here, not defined here.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .modules.startups.router import router as startups_router

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


app.include_router(startups_router)
