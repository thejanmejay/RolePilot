"""Job database model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import DateTime, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base

if TYPE_CHECKING:
    from backend.app.db.models.application import Application


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("linkedin_job_id", name="uq_jobs_linkedin_job_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    linkedin_job_id: Mapped[str] = mapped_column(
        Text, unique=True, nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    job_url: Mapped[str] = mapped_column(Text, nullable=False)
    employment_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    experience_level: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    salary_min: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    salary_max: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    collected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    raw_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    applications: Mapped[List[Application]] = relationship("Application", back_populates="job", cascade="all, delete-orphan")
