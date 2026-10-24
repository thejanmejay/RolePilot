"""User Policy Acceptance SQLAlchemy Model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base

if TYPE_CHECKING:
    from backend.app.db.models.profile import Profile


class UserPolicyAcceptance(Base):
    """Stores user consent and acceptance of platform policy versions."""
    __tablename__ = "user_policy_acceptances"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "policy_type", "policy_version",
            name="uq_user_policy_acceptances_user_type_version"
        ),
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
    policy_type: Mapped[str] = mapped_column(Text, default="platform_terms", nullable=False)
    policy_version: Mapped[str] = mapped_column(Text, nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship
    profile: Mapped[Profile] = relationship("Profile", backref="policy_acceptances")
