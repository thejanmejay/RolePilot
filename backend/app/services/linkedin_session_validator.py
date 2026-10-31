"""Centralized preflight LinkedIn session validation service.

Enforces server-side active browser session verification before initiating
any automation run (dry-run or live-run). Fails closed on network timeouts,
detects checkpoints/challenges, decrypts credentials strictly in memory,
and prevents concurrent validation bypasses.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models.linkedin_account import LinkedInAccount
from backend.app.services.linkedin_session_service import LinkedInSessionService

logger = logging.getLogger("rolepilot.linkedin_session_validator")

# Per-user concurrency locks to prevent race conditions during preflight
_user_validation_locks: Dict[uuid.UUID, asyncio.Lock] = {}
_locks_guard = asyncio.Lock()


async def _get_user_lock(user_id: uuid.UUID) -> asyncio.Lock:
    """Retrieve or create an asyncio Lock scoped to the given user ID."""
    async with _locks_guard:
        if user_id not in _user_validation_locks:
            _user_validation_locks[user_id] = asyncio.Lock()
        return _user_validation_locks[user_id]


@dataclass
class PreflightValidationResult:
    """Outcome of preflight LinkedIn session validation."""
    is_valid: bool
    error_code: Optional[str] = None
    error_title: Optional[str] = None
    error_message: Optional[str] = None
    detail: Optional[str] = None
    is_network_error: bool = False
    cookies: Optional[List[Dict[str, Any]]] = None


class LinkedInSessionValidator:
    """Centralized service for validating candidate LinkedIn session state."""

    @classmethod
    async def validate_session(
        cls,
        db: Session,
        user_id: uuid.UUID,
        timeout_seconds: int = 35,
    ) -> PreflightValidationResult:
        """Validate candidate's stored LinkedIn session using an isolated Playwright browser instance.

        Workflow:
        1. Query database for user's LinkedInAccount under strict user_id scoping.
        2. Decrypt ciphertext strictly in memory using Fernet.
        3. Structurally validate cookie format (must include non-empty 'li_at').
        4. Launch bounded headless Chromium instance with stealth patches.
        5. Navigate to LinkedIn and verify real authenticated DOM indicators.
        6. Fail closed on network timeouts without falsely marking sessions as expired.
        7. On confirmed authentication failure, mark account status as 'expired' in DB.
        """
        lock = await _get_user_lock(user_id)
        async with lock:
            return await cls._run_validation_locked(db, user_id, timeout_seconds=timeout_seconds)

    @classmethod
    async def _run_validation_locked(
        cls,
        db: Session,
        user_id: uuid.UUID,
        timeout_seconds: int = 35,
    ) -> PreflightValidationResult:
        # 1. Retrieve stored account record
        account = db.execute(
            select(LinkedInAccount).where(LinkedInAccount.user_id == user_id)
        ).scalar_one_or_none()

        if not account or not account.encrypted_session:
            logger.info("Preflight rejected: No stored LinkedIn session found for user %s", user_id)
            return PreflightValidationResult(
                is_valid=False,
                error_code="LINKEDIN_SESSION_MISSING",
                error_title="LinkedIn session required",
                error_message="Please connect your LinkedIn account to continue.",
                detail="No stored LinkedIn credentials found for this candidate account.",
            )

        if account.status == "disconnected":
            logger.info("Preflight rejected: LinkedIn account is disconnected for user %s", user_id)
            return PreflightValidationResult(
                is_valid=False,
                error_code="LINKEDIN_SESSION_MISSING",
                error_title="LinkedIn account disconnected",
                error_message="Your LinkedIn account is currently disconnected. Please reconnect to continue.",
                detail="Account status is set to disconnected.",
            )

        # 2. Decrypt in memory
        try:
            cookies = LinkedInSessionService.decrypt_session(account.encrypted_session)
        except Exception as exc:
            logger.warning("Preflight rejected: Decryption failed for user %s: %s", user_id, exc)
            cookies = None

        if not cookies:
            logger.warning("Preflight rejected: Stored session could not be decrypted for user %s", user_id)
            # Mark account as expired since stored credentials cannot be parsed
            account.status = "expired"
            account.updated_at = datetime.now(timezone.utc)
            db.commit()
            return PreflightValidationResult(
                is_valid=False,
                error_code="LINKEDIN_SESSION_INVALID",
                error_title="LinkedIn session expired",
                error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
                detail="Unable to decrypt stored session payload.",
            )

        # 3. Structural cookie validation
        from linkedin_hunter.auth.session import has_valid_session
        if not has_valid_session(cookies):
            logger.warning("Preflight rejected: Cookies missing essential 'li_at' for user %s", user_id)
            account.status = "expired"
            account.updated_at = datetime.now(timezone.utc)
            db.commit()
            return PreflightValidationResult(
                is_valid=False,
                error_code="LINKEDIN_SESSION_INVALID",
                error_title="LinkedIn session expired",
                error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
                detail="Decrypted cookies are missing a non-empty 'li_at' token.",
            )

        # 4. Active browser session verification with Playwright
        from linkedin_hunter.config import HunterConfig
        from linkedin_hunter.browser.engine import BrowserEngine
        from linkedin_hunter.auth.session import check_session_health

        hunter_config = HunterConfig()
        hunter_config.browser.headless = True
        hunter_config.browser.timeout = timeout_seconds * 1000

        engine: Optional[BrowserEngine] = None
        try:
            engine = BrowserEngine(hunter_config)
            # Launch with bounded timeout
            page = await asyncio.wait_for(
                engine.launch(headless=True),
                timeout=timeout_seconds,
            )

            # Load decrypted cookies into context
            await engine.load_cookies(cookies)

            # Check session health in browser
            health = await asyncio.wait_for(
                check_session_health(page, cookies=cookies),
                timeout=timeout_seconds,
            )

            # Detailed assessment of health result
            if health.get("authenticated") is True:
                account.status = "connected"
                account.last_login_at = datetime.now(timezone.utc)
                account.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.info("Preflight SUCCESS: LinkedIn session confirmed active for user %s", user_id)
                return PreflightValidationResult(
                    is_valid=True,
                    cookies=cookies,
                )

            # Checkpoint / Challenge detection
            if health.get("checkpoint_detected"):
                logger.warning("Preflight warning: Security checkpoint detected for user %s", user_id)
                # Keep account status connected/checkpoint rather than expired to inform user accurately
                return PreflightValidationResult(
                    is_valid=False,
                    error_code="LINKEDIN_CHECKPOINT_DETECTED",
                    error_title="LinkedIn security verification required",
                    error_message="LinkedIn security verification or challenge detected. Please log into LinkedIn manually in your browser to complete verification, then reconnect.",
                    detail=health.get("details", "Checkpoint challenge detected."),
                )

            # Check for network error / inconclusive in details
            health_details = str(health.get("details", "")).lower()
            # Redirect loop or login redirect is a confirmed session expiration
            is_redirect_expired = (
                health.get("login_redirect")
                or "redirect loop" in health_details
                or "err_too_many_redirects" in health_details
            )
            if is_redirect_expired:
                logger.warning("Preflight failed: Session expired (redirect loop/login redirect) for user %s: %s", user_id, health.get("details"))
                account.status = "expired"
                account.updated_at = datetime.now(timezone.utc)
                db.commit()
                return PreflightValidationResult(
                    is_valid=False,
                    error_code="LINKEDIN_SESSION_EXPIRED",
                    error_title="LinkedIn session expired",
                    error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
                    detail=health.get("details", "Authentication redirect loop (expired session)."),
                )

            # Check for network error / inconclusive in details (excluding redirect loops)
            is_net_err = any(
                x in health_details
                for x in ["timeout", "econnrefused", "name_not_resolved", "err_internet_disconnected", "connection error"]
            )
            if is_net_err:
                logger.warning("Preflight inconclusive due to network issue for user %s: %s", user_id, health.get("details"))
                # Fail closed, but DO NOT mark session as expired
                return PreflightValidationResult(
                    is_valid=False,
                    error_code="LINKEDIN_NETWORK_ERROR",
                    error_title="LinkedIn connection error",
                    error_message="Unable to verify LinkedIn session due to a network timeout or connection error. Please try again.",
                    detail=health.get("details"),
                    is_network_error=True,
                )

            # Confirmed unauthenticated / expired session (missing auth indicators)
            logger.warning("Preflight failed: Session expired or unauthenticated for user %s: %s", user_id, health.get("details"))
            account.status = "expired"
            account.updated_at = datetime.now(timezone.utc)
            db.commit()
            return PreflightValidationResult(
                is_valid=False,
                error_code="LINKEDIN_SESSION_EXPIRED",
                error_title="LinkedIn session expired",
                error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
                detail=health.get("details", "Session is not authenticated."),
            )

        except asyncio.TimeoutError:
            logger.warning("Preflight timed out after %ds for user %s", timeout_seconds, user_id)
            # Fail closed: Do NOT proceed, do NOT label as expired
            return PreflightValidationResult(
                is_valid=False,
                error_code="LINKEDIN_NETWORK_ERROR",
                error_title="LinkedIn connection timeout",
                error_message="LinkedIn session verification timed out. Please check your connection and try again.",
                detail=f"Operation timed out after {timeout_seconds} seconds.",
                is_network_error=True,
            )

        except Exception as exc:
            err_msg = str(exc)
            logger.warning("Preflight browser verification exception for user %s: %s", user_id, err_msg)
            # Distinguish network/Chromium errors from confirmed authentication failures
            err_lower = err_msg.lower()
            if "err_too_many_redirects" in err_lower or "redirect loop" in err_lower:
                logger.warning("Preflight failed: Session expired (redirect loop) for user %s: %s", user_id, err_msg)
                account.status = "expired"
                account.updated_at = datetime.now(timezone.utc)
                db.commit()
                return PreflightValidationResult(
                    is_valid=False,
                    error_code="LINKEDIN_SESSION_EXPIRED",
                    error_title="LinkedIn session expired",
                    error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
                    detail="Authentication redirect loop (expired session).",
                )

            is_net_err = any(
                x in err_lower
                for x in ["timeout", "net::err", "econnreset", "econnrefused", "connection closed", "failed to launch"]
            )
            if is_net_err:
                return PreflightValidationResult(
                    is_valid=False,
                    error_code="LINKEDIN_NETWORK_ERROR",
                    error_title="LinkedIn connection error",
                    error_message="Unable to verify LinkedIn session due to a browser or network error. Please try again.",
                    detail=err_msg,
                    is_network_error=True,
                )

            # Other unexpected errors fail closed
            return PreflightValidationResult(
                is_valid=False,
                error_code="LINKEDIN_VALIDATION_ERROR",
                error_title="Verification error",
                error_message="An unexpected error occurred while verifying your LinkedIn session. Please try again.",
                detail=err_msg,
            )

        finally:
            if engine:
                try:
                    if engine._page:
                        await engine._page.close()
                    if engine._context:
                        await engine._context.close()
                    if engine._browser:
                        await engine._browser.close()
                    if engine._playwright:
                        await engine._playwright.stop()
                except Exception:
                    pass
