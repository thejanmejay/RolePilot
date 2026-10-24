"""SearchConfig SQLAlchemy Model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Integer, Boolean, DateTime, Text, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base

if TYPE_CHECKING:
    from backend.app.db.models.profile import Profile
    from backend.app.db.models.automation_run import AutomationRun


class SearchConfig(Base):
    """Job search criteria mapped to Supabase public.search_configs table."""
    __tablename__ = "search_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), default="Default Search", nullable=False)
    keywords: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(200), default="India", nullable=False)
    job_type: Mapped[str] = mapped_column(String(50), default="full-time", nullable=False)
    experience_level: Mapped[str] = mapped_column(String(50), default="entry,associate", nullable=False)
    remote_type: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    date_posted: Mapped[str] = mapped_column(String(50), default="past-week", nullable=False)
    easy_apply_only: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    salary_min: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    salary_max: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_jobs: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    profile: Mapped[Profile] = relationship("Profile", back_populates="search_configs")
    automation_runs: Mapped[List[AutomationRun]] = relationship("AutomationRun", back_populates="search_config")
