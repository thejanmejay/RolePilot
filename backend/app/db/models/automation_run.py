"""AutomationRun database model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base

if TYPE_CHECKING:
    from backend.app.db.models.application import Application
    from backend.app.db.models.automation_log import AutomationLog
    from backend.app.db.models.profile import Profile
    from backend.app.db.models.search_config import SearchConfig


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    search_config_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("search_configs.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(Text, default="pending", nullable=False)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_live_submission: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    live_submission_confirmation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    max_jobs: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    search_overrides: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    selected_synced_job_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    resume_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True
    )
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Durable Queue and Lease Management
    worker_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True, index=True)

    jobs_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    applications_submitted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    applications_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    applications_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    profile: Mapped[Profile] = relationship("Profile", back_populates="automation_runs")
    search_config: Mapped[Optional[SearchConfig]] = relationship("SearchConfig", back_populates="automation_runs")
    applications: Mapped[List[Application]] = relationship("Application", back_populates="automation_run", cascade="all, delete-orphan")
    logs: Mapped[List[AutomationLog]] = relationship("AutomationLog", back_populates="automation_run", cascade="all, delete-orphan")
