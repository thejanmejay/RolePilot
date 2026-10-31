"""Notification SQLAlchemy model for RolePilot activity & status updates."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("idx_notifications_user_unread", "user_id", "is_read", "created_at"),
        Index("idx_notifications_user_archived", "user_id", "is_archived"),
        Index("idx_notifications_dedup", "user_id", "dedup_key", unique=False),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), default="automation", nullable=False, index=True
    )  # automation, applications, profile, account, system
    type: Mapped[str] = mapped_column(
        String(50), default="info", nullable=False
    )  # info, success, warning, error
    link: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    dedup_key: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True
    )
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
