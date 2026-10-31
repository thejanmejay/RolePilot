"""Policy Service for managing user consent and acceptance tracking."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.profile import Profile
from backend.app.schemas.policy import PolicyAcceptResponse, PolicyStatusResponse

logger = logging.getLogger(__name__)


class PolicyService:
    @staticmethod
    def get_active_policy_info() -> tuple[str, str]:
        """Returns the active (policy_type, policy_version)."""
        return settings.ACTIVE_POLICY_TYPE, settings.ACTIVE_POLICY_VERSION

    @staticmethod
    def get_acceptance_status(db: Session, user_id: uuid.UUID) -> PolicyStatusResponse:
        """Check whether the authenticated user has accepted the active policy."""
        policy_type, active_version = PolicyService.get_active_policy_info()

        # Query latest acceptance for active type
        stmt = (
            select(UserPolicyAcceptance)
            .where(
                UserPolicyAcceptance.user_id == user_id,
                UserPolicyAcceptance.policy_type == policy_type,
                UserPolicyAcceptance.policy_version == active_version,
            )
        )
        record = db.execute(stmt).scalar_one_or_none()

        if record:
            return PolicyStatusResponse(
                has_accepted=True,
                policy_type=policy_type,
                required_version=active_version,
                accepted_version=record.policy_version,
                accepted_at=record.accepted_at,
            )

        # Check if user accepted any previous version
        prev_stmt = (
            select(UserPolicyAcceptance)
            .where(
                UserPolicyAcceptance.user_id == user_id,
                UserPolicyAcceptance.policy_type == policy_type,
            )
            .order_by(UserPolicyAcceptance.accepted_at.desc())
        )
        prev_record = db.execute(prev_stmt).scalars().first()

        return PolicyStatusResponse(
            has_accepted=False,
            policy_type=policy_type,
            required_version=active_version,
            accepted_version=prev_record.policy_version if prev_record else None,
            accepted_at=prev_record.accepted_at if prev_record else None,
        )

    @staticmethod
    def accept_policy(
        db: Session,
        user_id: uuid.UUID,
        policy_type: Optional[str] = None,
        policy_version: Optional[str] = None,
    ) -> PolicyAcceptResponse:
        """Securely record policy acceptance with server-generated timestamp."""
        active_type, active_version = PolicyService.get_active_policy_info()

        chosen_type = (policy_type or active_type).strip()
        chosen_version = (policy_version or active_version).strip()

        # Validate that the version being accepted matches the active version
        if chosen_version != active_version or chosen_type != active_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid policy version '{chosen_version}'. Active version is '{active_version}'.",
            )

        from backend.app.services.account_service import AccountService

        if AccountService.is_account_deleted(db, user_id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account has been deleted.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Ensure user profile exists to satisfy foreign key constraint
        profile = db.get(Profile, user_id)
        if not profile:
            profile = Profile(
                id=user_id,
                email=f"user_{user_id}@example.com",
                first_name="Candidate",
                last_name="",
            )
            db.add(profile)
            db.flush()

        # Check for existing acceptance (idempotency)
        stmt = (
            select(UserPolicyAcceptance)
            .where(
                UserPolicyAcceptance.user_id == user_id,
                UserPolicyAcceptance.policy_type == chosen_type,
                UserPolicyAcceptance.policy_version == chosen_version,
            )
        )
        existing = db.execute(stmt).scalar_one_or_none()
        if existing:
            return PolicyAcceptResponse(
                success=True,
                policy_type=existing.policy_type,
                policy_version=existing.policy_version,
                accepted_at=existing.accepted_at,
                message="Policy acceptance already recorded.",
            )

        # Record new acceptance with authoritative server timestamp
        server_now = datetime.now(timezone.utc)
        new_acceptance = UserPolicyAcceptance(
            id=uuid.uuid4(),
            user_id=user_id,
            policy_type=chosen_type,
            policy_version=chosen_version,
            accepted_at=server_now,
            created_at=server_now,
        )

        db.add(new_acceptance)
        db.commit()
        db.refresh(new_acceptance)

        logger.info(
            "User %s accepted policy %s version %s at %s",
            user_id,
            chosen_type,
            chosen_version,
            new_acceptance.accepted_at,
        )

        return PolicyAcceptResponse(
            success=True,
            policy_type=new_acceptance.policy_type,
            policy_version=new_acceptance.policy_version,
            accepted_at=new_acceptance.accepted_at,
            message="Platform policy accepted successfully.",
        )

    @staticmethod
    def has_accepted_active_policy(db: Session, user_id: uuid.UUID) -> bool:
        """Returns True if the user has accepted the active policy, or if enforcement is disabled."""
        if not settings.ENFORCE_POLICY_ACCEPTANCE:
            return True
        status_resp = PolicyService.get_acceptance_status(db, user_id)
        return status_resp.has_accepted
