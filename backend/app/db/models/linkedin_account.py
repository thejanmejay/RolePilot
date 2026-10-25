"""LinkedInAccount SQLAlchemy Model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base

if TYPE_CHECKING:
    from backend.app.db.models.profile import Profile


class LinkedInAccount(Base):
    """User LinkedIn session state mapped to Supabase public.linkedin_accounts table."""
    __tablename__ = "linkedin_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_linkedin_accounts_user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    linkedin_profile_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="disconnected", nullable=False)
    encrypted_session: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    @property
    def is_connected(self) -> bool:
        """Helper to determine if the account is in a connected state with stored credentials."""
        return self.status == "connected" and bool(self.encrypted_session)

    # Relationships
    profile: Mapped[Profile] = relationship("Profile", back_populates="linkedin_account")
