"""Profile SQLAlchemy Model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base

if TYPE_CHECKING:
    from backend.app.db.models.application import Application
    from backend.app.db.models.automation_run import AutomationRun
    from backend.app.db.models.education import Education
    from backend.app.db.models.experience import Experience
    from backend.app.db.models.linkedin_account import LinkedInAccount
    from backend.app.db.models.resume import Resume
    from backend.app.db.models.search_config import SearchConfig
    from backend.app.db.models.skill import Skill


class Profile(Base):
    """User profile mapped to Supabase public.profiles table."""
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(Text, default="India", nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    experience_years: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    experience_months: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notice_period_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    current_ctc: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    expected_ctc: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    authorized_to_work: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    willing_to_relocate: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    experiences: Mapped[List[Experience]] = relationship("Experience", back_populates="profile", cascade="all, delete-orphan")
    skills: Mapped[List[Skill]] = relationship("Skill", back_populates="profile", cascade="all, delete-orphan")
    educations: Mapped[List[Education]] = relationship("Education", back_populates="profile", cascade="all, delete-orphan")
    resumes: Mapped[List[Resume]] = relationship("Resume", back_populates="profile", cascade="all, delete-orphan")
    linkedin_account: Mapped[Optional[LinkedInAccount]] = relationship("LinkedInAccount", back_populates="profile", uselist=False, cascade="all, delete-orphan")
    search_configs: Mapped[List[SearchConfig]] = relationship("SearchConfig", back_populates="profile", cascade="all, delete-orphan")
    automation_runs: Mapped[List[AutomationRun]] = relationship("AutomationRun", back_populates="profile", cascade="all, delete-orphan")
    applications: Mapped[List[Application]] = relationship("Application", back_populates="profile", cascade="all, delete-orphan")
