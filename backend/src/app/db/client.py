import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

connection_string = os.environ.get("DATABASE_URL")
if not connection_string:
    raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and fill it in.")

engine = create_engine(connection_string)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI dependency: yields a request-scoped SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
