"""Authenticated account deletion across RolePilot data and Supabase Auth."""

from __future__ import annotations

import logging
import uuid
from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from supabase import Client, create_client

from backend.app.core.config import settings
from backend.app.db.models.application import Application
from backend.app.db.models.application_answer import ApplicationAnswer
from backend.app.db.models.automation_log import AutomationLog
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.education import Education
from backend.app.db.models.email_reservation import EmailReservation
from backend.app.db.models.experience import Experience
from backend.app.db.models.linkedin_account import LinkedInAccount
from backend.app.db.models.notification import Notification
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.search_config import SearchConfig
from backend.app.db.models.skill import Skill

logger = logging.getLogger(__name__)


def get_supabase_admin_client() -> Client:
    """Build a trusted server-side Supabase client for account administration."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account deletion is not configured on the server.",
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _is_missing_auth_user(exc: Exception) -> bool:
    """Recognize an already deleted Auth user so retries remain idempotent."""
    code = str(getattr(exc, "code", "") or "").lower()
    response_status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
    message = str(exc).lower()
    return (
        str(response_status) in {"404", "400"} and ("not found" in message or "does not exist" in message or "user" in message)
    ) or str(response_status) == "404" or code in {"user_not_found", "not_found", "404"} or (
        ("user" in message or "auth" in message or "identity" in message) and ("not found" in message or "does not exist" in message)
    )


def _is_missing_storage_object(exc: Exception) -> bool:
    """Treat an already removed object as success on a deletion retry."""
    code = str(getattr(exc, "code", "") or "").lower()
    response_status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
    message = str(exc).lower()
    if code in {"nosuchbucket", "bucket_not_found"} or ("bucket" in message and "not found" in message):
        return False
    return (
        code in {"nosuchkey", "object_not_found", "not_found", "404"}
        or str(response_status) == "404"
        or ("not found" in message and "bucket" not in message)
        or "does not exist" in message
    )


DELETED_ACCOUNT_REGISTRATION_MESSAGE = (
    "An account associated with this email address was previously deleted, "
    "and a new account cannot be created with it. If you believe this is a "
    "mistake or need assistance, please contact RolePilot Support."
)


class AccountService:
    """Delete only the authenticated user's data, then delete their Auth identity."""

    @staticmethod
    def delete_account(db: Session, user_id: uuid.UUID) -> None:
        # Validate configuration before any destructive cleanup.
        try:
            admin = get_supabase_admin_client()
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Could not initialize Supabase Admin client for account deletion")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Account deletion is not available right now.",
            ) from exc

        try:
            storage_paths = list(
                db.execute(
                    select(Resume.storage_path).where(Resume.user_id == user_id)
                ).scalars()
            )
        except Exception as exc:
            db.rollback()
            logger.exception("Could not read account data for deletion")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not prepare account deletion. Please retry.",
            ) from exc

        # Preserve resume metadata if Storage fails so the exact keys remain
        # available for a safe retry. The values come only from this user's rows.
        expected_prefix = f"resumes/{user_id}/"
        if any(not path.startswith(expected_prefix) for path in storage_paths):
            db.rollback()
            logger.error("Resume storage path was outside the deleting user's storage prefix")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Account files could not be safely identified. No database records were deleted.",
            )

        if storage_paths:
            bucket = admin.storage.from_(settings.RESUME_STORAGE_BUCKET)
            for path in storage_paths:
                try:
                    # Individual removal makes partial success retryable: missing
                    # objects are harmless, while other failures retain metadata.
                    bucket.remove([path])
                except Exception as exc:
                    if _is_missing_storage_object(exc):
                        continue
                    db.rollback()
                    logger.warning("Resume storage cleanup failed during account deletion")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Could not remove account files. No database records were deleted; please retry.",
                    ) from exc

        try:
            # Capture the candidate's email identity to enforce reservation against re-registration
            existing_res = db.execute(
                select(EmailReservation).where(EmailReservation.user_id == user_id)
            ).scalar_one_or_none()

            profile_email = db.execute(
                select(Profile.email).where(Profile.id == user_id)
            ).scalar_one_or_none()

            user_email = profile_email
            if not user_email:
                try:
                    auth_user = admin.auth.admin.get_user_by_id(str(user_id))
                    user_email = (
                        getattr(getattr(auth_user, "user", auth_user), "email", None)
                        if auth_user
                        else None
                    )
                except Exception:
                    pass

            normalized_email = (
                AccountService.normalize_email(user_email)
                if (user_email and user_email.strip())
                else None
            )

            if not existing_res:
                target_email = normalized_email or f"deleted-{user_id}@deleted.rolepilot.local"
                clash_res = db.execute(
                    select(EmailReservation).where(
                        EmailReservation.normalized_email == target_email
                    )
                ).scalar_one_or_none()
                if clash_res:
                    clash_res.user_id = user_id
                else:
                    reservation = EmailReservation(
                        id=uuid.uuid4(),
                        normalized_email=target_email,
                        user_id=user_id,
                        reason="account_deleted",
                    )
                    db.add(reservation)
            elif normalized_email and existing_res.normalized_email != normalized_email:
                existing_res.normalized_email = normalized_email

            application_ids = select(Application.id).where(Application.user_id == user_id)
            run_ids = select(AutomationRun.id).where(AutomationRun.user_id == user_id)

            # Explicit child-first deletes work even when FK cascades are not
            # enabled in a local SQLite test database or an older deployment.
            db.execute(
                delete(ApplicationAnswer).where(
                    ApplicationAnswer.application_id.in_(application_ids)
                )
            )
            db.execute(
                delete(AutomationLog).where(
                    or_(
                        AutomationLog.run_id.in_(run_ids),
                        AutomationLog.application_id.in_(application_ids),
                    )
                )
            )
            db.execute(delete(Application).where(Application.user_id == user_id))
            db.execute(delete(AutomationRun).where(AutomationRun.user_id == user_id))
            db.execute(delete(Notification).where(Notification.user_id == user_id))
            db.execute(delete(UserPolicyAcceptance).where(UserPolicyAcceptance.user_id == user_id))
            db.execute(delete(SearchConfig).where(SearchConfig.user_id == user_id))
            db.execute(delete(Resume).where(Resume.user_id == user_id))
            db.execute(delete(LinkedInAccount).where(LinkedInAccount.user_id == user_id))
            db.execute(delete(Skill).where(Skill.user_id == user_id))
            db.execute(delete(Experience).where(Experience.user_id == user_id))
            db.execute(delete(Education).where(Education.user_id == user_id))
            db.execute(delete(Profile).where(Profile.id == user_id))
            db.commit()
        except IntegrityError:
            db.rollback()
            # If concurrent execution reserved the email or deleted rows, verify reservation exists
            confirmed_res = db.execute(
                select(EmailReservation).where(EmailReservation.user_id == user_id)
            ).scalar_one_or_none()
            if not confirmed_res and normalized_email:
                confirmed_res = db.execute(
                    select(EmailReservation).where(
                        EmailReservation.normalized_email == normalized_email
                    )
                ).scalar_one_or_none()
            if not confirmed_res:
                logger.exception("Database integrity conflict during account deletion")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not remove account data. Please retry.",
                )
        except Exception as exc:
            db.rollback()
            logger.exception("Database cleanup failed during account deletion")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not remove account data. Please retry.",
            ) from exc

        # Auth deletion is last. If it fails, the signed token can retry this
        # endpoint: data cleanup is idempotent and the Auth identity still exists.
        try:
            admin.auth.admin.delete_user(str(user_id), should_soft_delete=False)
        except Exception as exc:
            if _is_missing_auth_user(exc):
                return
            logger.warning("Supabase Auth deletion failed for account %s", user_id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Account data was removed, but the Auth account could not be deleted. Please retry.",
            ) from exc

    @staticmethod
    def normalize_email(email: str) -> str:
        """Canonically normalize email for reservation and comparison.

        Strips leading/trailing whitespace, converts to lowercase, and strips trailing periods.
        """
        if not email:
            return ""
        return email.strip().rstrip(".").lower()

    @staticmethod
    def is_account_deleted(db: Session, user_id: uuid.UUID) -> bool:
        """Check whether user_id is recorded as a deleted account."""
        stmt = select(EmailReservation.id).where(
            EmailReservation.user_id == user_id,
            EmailReservation.reason == "account_deleted",
        )
        return db.execute(stmt).scalar_one_or_none() is not None

    @staticmethod
    def is_email_reserved(db: Session, email: str) -> bool:
        """Check whether a normalized email identity is reserved by a deleted account."""
        if not email or not email.strip():
            return False
        normalized = AccountService.normalize_email(email)
        stmt = select(EmailReservation.id).where(EmailReservation.normalized_email == normalized)
        return db.execute(stmt).scalar_one_or_none() is not None

    @staticmethod
    def validate_registration_email(db: Session, email: str) -> None:
        """Reject registration attempts for reserved deleted-account email identities."""
        if AccountService.is_email_reserved(db, email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=DELETED_ACCOUNT_REGISTRATION_MESSAGE,
            )


