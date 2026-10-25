"""Service for LinkedIn session encryption, validation, consent tracking, and multi-tenant lifecycle."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.models.linkedin_account import LinkedInAccount
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance

logger = logging.getLogger(__name__)

POLICY_TYPE_LINKEDIN = "linkedin_automation"
DEFAULT_CONSENT_VERSION = "v1.0"


class LinkedInSessionService:
    """Encrypted storage and lifecycle manager for LinkedIn candidate sessions."""

    @staticmethod
    def _get_fernet() -> Fernet:
        """Derive a secure 32-byte URL-safe encryption key from backend secrets.
        
        Strict production safeguard:
        Requires a dedicated strong SESSION_ENCRYPTION_KEY in production.
        Never falls back to unrelated secrets or hardcoded fallback keys in production.
        """
        secret = getattr(settings, "SESSION_ENCRYPTION_KEY", None)

        if settings.ENVIRONMENT.lower() == "production":
            if not secret or len(secret.strip()) < 32:
                raise RuntimeError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: A dedicated strong SESSION_ENCRYPTION_KEY "
                    "(minimum 32 characters) must be configured in production to encrypt "
                    "LinkedIn session credentials. Silently falling back to unrelated secrets or default keys is strictly forbidden."
                )
        else:
            if not secret or len(secret.strip()) < 16:
                # In non-production/test environments only, use an explicit test key
                logger.warning(
                    "Using non-production development encryption key for LinkedIn sessions. "
                    "Ensure dedicated SESSION_ENCRYPTION_KEY is provided in production."
                )
                secret = "rolepilot-dev-test-encryption-key-32"

        derived_key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
        return Fernet(derived_key)

    @classmethod
    def encrypt_session(cls, raw_input: str | List[Dict[str, Any]]) -> str:
        """Standardize cookie format and encrypt session payload with authenticated AES/Fernet."""
        cookies: List[Dict[str, Any]] = []

        if isinstance(raw_input, list):
            cookies = raw_input
        elif isinstance(raw_input, str):
            trimmed = raw_input.strip()
            # Check if JSON array was provided
            if trimmed.startswith("[") and trimmed.endswith("]"):
                try:
                    parsed = json.loads(trimmed)
                    if isinstance(parsed, list):
                        cookies = parsed
                except Exception:
                    pass

            # Otherwise treat as direct li_at token string
            if not cookies:
                clean_token = trimmed.replace("li_at=", "").strip().strip(";'\"")
                cookies = [
                    {
                        "name": "li_at",
                        "value": clean_token,
                        "domain": ".linkedin.com",
                        "path": "/",
                        "httpOnly": True,
                        "secure": True,
                        "sameSite": "None",
                    }
                ]

        # Verify essential session cookie presence
        has_li_at = any(
            isinstance(c, dict)
            and c.get("name") == "li_at"
            and bool(str(c.get("value", "")).strip())
            for c in cookies
        )
        if not has_li_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid LinkedIn session data: Missing essential 'li_at' cookie.",
            )

        fernet = cls._get_fernet()
        json_bytes = json.dumps(cookies).encode("utf-8")
        encrypted_bytes = fernet.encrypt(json_bytes)
        return encrypted_bytes.decode("utf-8")

    @classmethod
    def decrypt_session(cls, encrypted_str: Optional[str]) -> Optional[List[Dict[str, Any]]]:
        """Decrypt session ciphertext into list of browser cookies."""
        if not encrypted_str or not encrypted_str.strip():
            return None

        try:
            fernet = cls._get_fernet()
            decrypted_bytes = fernet.decrypt(encrypted_str.encode("utf-8"))
            parsed = json.loads(decrypted_bytes.decode("utf-8"))
            if isinstance(parsed, list):
                return parsed
            return None
        except Exception as exc:
            logger.warning("Failed to decrypt LinkedIn session credentials: %s", exc)
            return None

    @classmethod
    def get_status(cls, db: Session, user_id: uuid.UUID) -> Dict[str, Any]:
        """Retrieve connection state and active consent record for the specified user."""
        account = db.execute(
            select(LinkedInAccount).where(LinkedInAccount.user_id == user_id)
        ).scalar_one_or_none()

        consent = db.execute(
            select(UserPolicyAcceptance)
            .where(
                UserPolicyAcceptance.user_id == user_id,
                UserPolicyAcceptance.policy_type == POLICY_TYPE_LINKEDIN,
            )
            .order_by(UserPolicyAcceptance.accepted_at.desc())
        ).scalars().first()

        is_connected = False
        raw_status = "disconnected"
        last_login_at = None
        profile_url = None

        if account:
            raw_status = account.status
            last_login_at = account.last_login_at
            profile_url = account.linkedin_profile_url
            if account.status == "connected" and bool(account.encrypted_session):
                is_connected = True

        return {
            "is_connected": is_connected,
            "status": raw_status,
            "has_consent": consent is not None,
            "consent_version": consent.policy_version if consent else None,
            "consent_accepted_at": consent.accepted_at if consent else None,
            "last_login_at": last_login_at,
            "linkedin_profile_url": profile_url,
        }

    @classmethod
    def save_session(
        cls,
        db: Session,
        user_id: uuid.UUID,
        session_token: str,
        profile_url: Optional[str] = None,
    ) -> LinkedInAccount:
        """Encrypt and persist candidate LinkedIn session credentials."""
        encrypted_ciphertext = cls.encrypt_session(session_token)

        account = db.execute(
            select(LinkedInAccount).where(LinkedInAccount.user_id == user_id)
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if not account:
            account = LinkedInAccount(
                user_id=user_id,
                status="connected",
                encrypted_session=encrypted_ciphertext,
                linkedin_profile_url=profile_url.strip() if profile_url else None,
                last_login_at=now,
            )
            db.add(account)
        else:
            account.status = "connected"
            account.encrypted_session = encrypted_ciphertext
            if profile_url:
                account.linkedin_profile_url = profile_url.strip()
            account.last_login_at = now
            account.updated_at = now

        db.commit()
        db.refresh(account)
        logger.info("Encrypted LinkedIn session saved for user %s", user_id)
        return account

    @classmethod
    def record_consent(
        cls,
        db: Session,
        user_id: uuid.UUID,
        policy_version: str = DEFAULT_CONSENT_VERSION,
    ) -> UserPolicyAcceptance:
        """Record or update verified candidate permission consent for automation workflows."""
        existing = db.execute(
            select(UserPolicyAcceptance).where(
                UserPolicyAcceptance.user_id == user_id,
                UserPolicyAcceptance.policy_type == POLICY_TYPE_LINKEDIN,
                UserPolicyAcceptance.policy_version == policy_version,
            )
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if existing:
            existing.accepted_at = now
            db.commit()
            db.refresh(existing)
            return existing

        acceptance = UserPolicyAcceptance(
            user_id=user_id,
            policy_type=POLICY_TYPE_LINKEDIN,
            policy_version=policy_version,
            accepted_at=now,
        )
        db.add(acceptance)
        db.commit()
        db.refresh(acceptance)
        logger.info("Recorded LinkedIn automation consent (%s) for user %s", policy_version, user_id)
        return acceptance

    @classmethod
    def disconnect(cls, db: Session, user_id: uuid.UUID) -> None:
        """Securely wipe stored session ciphertext and mark account disconnected."""
        account = db.execute(
            select(LinkedInAccount).where(LinkedInAccount.user_id == user_id)
        ).scalar_one_or_none()

        if account:
            account.status = "disconnected"
            account.encrypted_session = None
            account.last_login_at = None
            account.updated_at = datetime.now(timezone.utc)
            db.commit()
            logger.info("LinkedIn session disconnected and credentials wiped for user %s", user_id)

    @classmethod
    def revoke_consent(cls, db: Session, user_id: uuid.UUID) -> None:
        """Revoke user's automation purpose consent."""
        db.execute(
            delete(UserPolicyAcceptance).where(
                UserPolicyAcceptance.user_id == user_id,
                UserPolicyAcceptance.policy_type == POLICY_TYPE_LINKEDIN,
            )
        )
        db.commit()
        logger.info("Revoked LinkedIn automation consent for user %s", user_id)

    @classmethod
    def mark_expired(cls, db: Session, user_id: uuid.UUID) -> None:
        """Flag the user's session as expired following a failed browser authentication check."""
        account = db.execute(
            select(LinkedInAccount).where(LinkedInAccount.user_id == user_id)
        ).scalar_one_or_none()

        if account:
            account.status = "expired"
            account.updated_at = datetime.now(timezone.utc)
            db.commit()
            logger.warning("Flagged LinkedIn session as expired for user %s", user_id)
