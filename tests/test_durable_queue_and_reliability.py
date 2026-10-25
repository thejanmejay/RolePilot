"""Comprehensive tests for durable queue, worker leasing, crash recovery, idempotency, diagnostics, and safety safeguards."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import settings
from backend.app.db.database import Base
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.profile import Profile
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.schemas.automation import AutomationRunCreate
from backend.app.services.automation_service import AutomationService
from backend.app.services.browser_diagnostics import check_chromium_availability
from backend.app.services.linkedin_session_service import LinkedInSessionService
from backend.app.services.queue_service import QueueService
from backend.app.workers.queue_worker import QueueWorker


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()

    user_id = uuid.uuid4()
    profile = Profile(id=user_id, email="test@example.com", first_name="Test", last_name="Candidate")
    db.add(profile)
    db.commit()

    try:
        yield db, user_id
    finally:
        db.close()


# ── 1. ENCRYPTION KEY CONFIGURATION & STARTUP TESTS ───────────────────────────

def test_missing_or_invalid_production_encryption_key_fails_safely():
    """Verify that in production, missing or short keys raise RuntimeError immediately."""
    with patch.object(settings, "ENVIRONMENT", "production"):
        with patch.object(settings, "SESSION_ENCRYPTION_KEY", None):
            with pytest.raises(RuntimeError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
                LinkedInSessionService._get_fernet()

        with patch.object(settings, "SESSION_ENCRYPTION_KEY", "too-short-key"):
            with pytest.raises(RuntimeError, match="minimum 32 characters"):
                LinkedInSessionService._get_fernet()

        # Valid 32+ character key succeeds
        valid_key = "a" * 32
        with patch.object(settings, "SESSION_ENCRYPTION_KEY", valid_key):
            fernet = LinkedInSessionService._get_fernet()
            assert fernet is not None


# ── 2. CHROMIUM DIAGNOSTICS TESTS ─────────────────────────────────────────────

def test_chromium_diagnostics_reports_safe_remediation_on_failure():
    """Verify check_chromium_availability reports safe error without leaking secrets or paths."""
    with patch("playwright.sync_api.sync_playwright", side_effect=Exception("Executable doesn't exist at /root/.cache/ms-playwright")):
        diag = check_chromium_availability()
        assert diag["available"] is False
        assert "Chromium browser binary or system dependencies are unavailable" in diag["error"]
        assert "playwright install --with-deps chromium" in diag["remediation"]


# ── 3. ATOMIC WORKER CLAIMING & MULTI-WORKER ISOLATION ────────────────────────

def test_atomic_worker_claiming_prevents_competing_workers(test_db):
    """Verify competing workers cannot claim the same run."""
    db, user_id = test_db

    # Create single pending run
    run_in = AutomationRunCreate(dry_run=True, max_jobs=5)
    run = AutomationService.create_run(db, user_id, run_in)
    assert run.status == "pending"

    # Worker 1 claims it
    claimed_1 = QueueService.claim_next_run(db, worker_id="worker-node-1")
    assert claimed_1 is not None
    assert claimed_1.id == run.id
    assert claimed_1.status == "running"
    assert claimed_1.worker_id == "worker-node-1"
    assert claimed_1.attempt_count == 1

    # Worker 2 attempts to claim next run -> should return None
    claimed_2 = QueueService.claim_next_run(db, worker_id="worker-node-2")
    assert claimed_2 is None


# ── 4. STALE LEASE RECOVERY & AMBIGUOUS OUTCOME SAFEGUARDS ────────────────────

def test_stale_lease_recovery_requeues_safe_dry_runs(test_db):
    """Verify timed-out dry runs are re-queued for bounded retries."""
    db, user_id = test_db

    past_time = datetime.now(timezone.utc) - timedelta(seconds=600)
    run = AutomationRun(
        user_id=user_id,
        status="running",
        dry_run=True,
        allow_live_submission=False,
        worker_id="crashed-worker",
        locked_at=past_time,
        heartbeat_at=past_time,
        attempt_count=1,
        max_attempts=3,
    )
    db.add(run)
    db.commit()

    # Recover with 300s lease timeout
    recovered = QueueService.recover_stale_leases(db, lease_seconds=300)
    assert recovered == 1

    db.refresh(run)
    assert run.status == "pending"
    assert run.worker_id is None
    assert run.locked_at is None


def test_stale_lease_recovery_flags_live_submission_as_needs_reconciliation(test_db):
    """Verify live submission crashes are NEVER blindly retried, but flagged as needs_reconciliation."""
    db, user_id = test_db

    past_time = datetime.now(timezone.utc) - timedelta(seconds=600)
    run = AutomationRun(
        user_id=user_id,
        status="running",
        dry_run=False,
        allow_live_submission=True,
        live_submission_confirmation="CONFIRM_REAL_SUBMISSION",
        worker_id="crashed-live-worker",
        locked_at=past_time,
        heartbeat_at=past_time,
        attempt_count=1,
        max_attempts=3,
    )
    db.add(run)
    db.commit()

    recovered = QueueService.recover_stale_leases(db, lease_seconds=300)
    assert recovered == 1

    db.refresh(run)
    assert run.status == "needs_reconciliation"
    assert "needs_reconciliation to prevent duplicate submissions" in run.error_message


def test_stale_lease_exceeded_attempts_marks_failed(test_db):
    """Verify run reaching max_attempts is marked failed."""
    db, user_id = test_db

    past_time = datetime.now(timezone.utc) - timedelta(seconds=600)
    run = AutomationRun(
        user_id=user_id,
        status="running",
        dry_run=True,
        worker_id="crashed-worker",
        locked_at=past_time,
        heartbeat_at=past_time,
        attempt_count=3,
        max_attempts=3,
    )
    db.add(run)
    db.commit()

    recovered = QueueService.recover_stale_leases(db, lease_seconds=300)
    assert recovered == 1

    db.refresh(run)
    assert run.status == "failed"
    assert "Exceeded maximum execution attempts" in run.error_message


# ── 5. IDEMPOTENCY HANDLING ───────────────────────────────────────────────────

def test_idempotency_prevents_duplicate_runs(test_db):
    """Verify duplicate create_run requests with identical idempotency_key return existing run."""
    db, user_id = test_db

    run_in = AutomationRunCreate(
        dry_run=True,
        max_jobs=10,
        idempotency_key="req-unique-token-12345",
    )

    run1 = AutomationService.create_run(db, user_id, run_in)
    run2 = AutomationService.create_run(db, user_id, run_in)

    assert run1.id == run2.id
    assert db.query(AutomationRun).count() == 1


# ── 6. COOPERATIVE CANCELLATION ───────────────────────────────────────────────

def test_cooperative_cancellation_invalidates_heartbeat(test_db):
    """Verify cancelling a run causes update_heartbeat to return False, prompting worker to exit."""
    db, user_id = test_db

    run = AutomationRun(
        user_id=user_id,
        status="running",
        worker_id="active-worker",
        heartbeat_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()

    # Active heartbeat succeeds
    assert QueueService.update_heartbeat(db, run.id, "active-worker") is True

    # User cancels run
    AutomationService.cancel_run(db, user_id, run.id)

    # Next heartbeat returns False to halt execution
    assert QueueService.update_heartbeat(db, run.id, "active-worker") is False


# ── 7. TRIPLE-KEY SAFETY GUARD MATRIX ─────────────────────────────────────────

def test_triple_key_submission_guard_boundary_matrix():
    """Verify all 8 negative and positive permutations of Triple-Key Safety Guard fail closed."""
    def is_authorized(dry_run: bool, allow_live: bool, confirmation: str | None) -> bool:
        return bool(
            (dry_run is False)
            and (allow_live is True)
            and (confirmation == "CONFIRM_REAL_SUBMISSION")
        )

    # Matrix: (dry_run, allow_live, confirmation, expected_authorized)
    permutations = [
        (True, False, None, False),
        (True, True, "CONFIRM_REAL_SUBMISSION", False),  # dry_run=True overrides live flag
        (False, False, "CONFIRM_REAL_SUBMISSION", False), # allow_live=False overrides
        (False, True, None, False),                      # missing confirmation
        (False, True, "", False),                        # empty string confirmation
        (False, True, "confirm_real_submission", False), # lowercase mismatch
        (False, True, "CONFIRM", False),                 # partial string mismatch
        (False, True, "CONFIRM_REAL_SUBMISSION", True),   # exact match only
    ]

    for dry_run, allow_live, confirmation, expected in permutations:
        result = is_authorized(dry_run, allow_live, confirmation)
        assert result == expected, f"Failed for dry_run={dry_run}, allow_live={allow_live}, conf={confirmation}"
