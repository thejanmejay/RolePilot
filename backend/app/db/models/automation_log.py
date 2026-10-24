"""AutomationLog database model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base

if TYPE_CHECKING:
    from backend.app.db.models.application import Application
    from backend.app.db.models.automation_run import AutomationRun


class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("automation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    level: Mapped[str] = mapped_column(Text, default="INFO", nullable=False)
    event: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    automation_run: Mapped[AutomationRun] = relationship("AutomationRun", back_populates="logs")
    application: Mapped[Optional[Application]] = relationship("Application", back_populates="logs")
