"""SQLAlchemy 2.x Database Session and Connection Setup."""

from __future__ import annotations

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from backend.app.core.config import settings


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy models."""
    pass


# Create database engine with SQLite or Postgres support
is_sqlite = settings.sqlalchemy_database_url.startswith("sqlite")
engine_kwargs = {"echo": False}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    if ":memory:" in settings.sqlalchemy_database_url:
        from sqlalchemy.pool import StaticPool
        engine_kwargs["poolclass"] = StaticPool
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(settings.sqlalchemy_database_url, **engine_kwargs)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
