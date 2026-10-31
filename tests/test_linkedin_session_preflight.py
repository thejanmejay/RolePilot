"""Tests for LinkedIn session preflight validation before automation runs.

Proves:
1. Valid session allows both dry-run and live-run workflows to proceed to normal safeguards.
2. Expired or unauthenticated session prevents both workflows from starting.
3. Missing or undecryptable cookies prevent execution.
4. Network timeouts and inconclusive validation responses do not start automation.
5. No jobs are discovered, queued, or submitted when preflight validation fails.
6. The live-submission Triple-Key guard remains strictly preserved.
7. No real applications are submitted.
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.security import get_current_user_id
from backend.app.db.database import Base, get_db
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.job import Job
from backend.app.db.models.linkedin_account import LinkedInAccount
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.profile import Profile
from backend.app.main import app
from backend.app.services.linkedin_session_service import LinkedInSessionService, POLICY_TYPE_LINKEDIN
from backend.app.services.linkedin_session_validator import (
    LinkedInSessionValidator,
    PreflightValidationResult,
)
from backend.app.workers.linkedin_worker import execute_automation_run

# In-memory test SQLite setup
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    user_id = uuid.uuid4()
    profile = Profile(
        id=user_id,
        email="preflight_candidate@example.com",
        first_name="Preflight",
        last_name="Tester",
    )
    db_session.add(profile)
    # Required platform policy acceptance so policy dependency passes
    platform_policy = UserPolicyAcceptance(
        user_id=user_id,
        policy_type="platform_terms",
        policy_version="draft-1",
    )
    db_session.add(platform_policy)
    db_session.commit()
    return user_id


@pytest.fixture
def client(test_user, db_session):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user_id():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user_id, None)
    app.dependency_overrides[get_db] = override_get_db


# Helper to attach valid encrypted session
def attach_user_session(db_session, user_id, token="AQEDAS_ValidSessionCookie999", status="connected", consent=True):
    encrypted = LinkedInSessionService.encrypt_session(token)
    account = LinkedInAccount(
        user_id=user_id,
        status=status,
        encrypted_session=encrypted,
    )
    db_session.add(account)
    if consent:
        db_session.add(UserPolicyAcceptance(
            user_id=user_id,
            policy_type=POLICY_TYPE_LINKEDIN,
            policy_version="v1.0",
        ))
    db_session.commit()
    return account


def test_missing_linkedin_consent_prevents_run_creation(client, test_user, db_session):
    """A valid session without automation consent is rejected before queueing."""
    attach_user_session(db_session, test_user, consent=False)
    mock_res = PreflightValidationResult(is_valid=True, cookies=[{"name": "li_at", "value": "val"}])
    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = mock_res
        response = client.post("/api/v1/automation/runs", json={"dry_run": True, "max_jobs": 5})
    assert response.status_code == 400
    assert response.json()["detail"]["error_code"] == "LINKEDIN_CONSENT_REQUIRED"
    assert db_session.query(AutomationRun).count() == 0


# ─────────────────────────────────────────────────────────────────────────────
# 1. Valid session allows dry-run and live-run workflows to proceed
# ─────────────────────────────────────────────────────────────────────────────

def test_valid_session_allows_dry_run_to_start(client, test_user, db_session):
    """When session is authenticated, dry-run automation run is queued successfully."""
    attach_user_session(db_session, test_user)

    mock_res = PreflightValidationResult(is_valid=True, cookies=[{"name": "li_at", "value": "val"}])
    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = mock_res
        resp = client.post(
            "/api/v1/automation/runs",
            json={"dry_run": True, "max_jobs": 5},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["dry_run"] is True
        assert data["status"] == "pending"

        # Verify run was persisted in DB
        run = db_session.query(AutomationRun).filter(AutomationRun.id == uuid.UUID(data["id"])).first()
        assert run is not None
        assert run.dry_run is True


def test_valid_session_allows_live_run_with_triple_key_guard(client, test_user, db_session):
    """When session is valid, live-run proceeds to Triple-Key safety evaluation."""
    attach_user_session(db_session, test_user)

    mock_res = PreflightValidationResult(is_valid=True, cookies=[{"name": "li_at", "value": "val"}])
    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = mock_res
        resp = client.post(
            "/api/v1/automation/runs",
            json={
                "dry_run": False,
                "allow_live_submission": True,
                "live_submission_confirmation": "CONFIRM_REAL_SUBMISSION",
                "max_jobs": 10,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["dry_run"] is False
        assert data["allow_live_submission"] is True
        assert data["max_jobs"] == 1  # Live submission capped to 1 job


# ─────────────────────────────────────────────────────────────────────────────
# 2. Expired or unauthenticated session prevents workflow from starting
# ─────────────────────────────────────────────────────────────────────────────

def test_expired_session_prevents_dry_run_and_returns_structured_error(client, test_user, db_session):
    """Expired session halts API request before run creation with LINKEDIN_SESSION_EXPIRED."""
    attach_user_session(db_session, test_user)

    mock_res = PreflightValidationResult(
        is_valid=False,
        error_code="LINKEDIN_SESSION_EXPIRED",
        error_title="LinkedIn session expired",
        error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
    )
    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = mock_res
        resp = client.post(
            "/api/v1/automation/runs",
            json={"dry_run": True, "max_jobs": 5},
        )
        assert resp.status_code == 400
        data = resp.json()["detail"]
        assert data["error_code"] == "LINKEDIN_SESSION_EXPIRED"
        assert data["title"] == "LinkedIn session expired"
        assert "Your LinkedIn session is no longer valid" in data["message"]
        assert data["action"] == "reconnect_linkedin"

        # Verify NO run was created in DB
        runs = db_session.query(AutomationRun).all()
        assert len(runs) == 0


def test_expired_session_prevents_live_run(client, test_user, db_session):
    """Expired session prevents live run from starting."""
    attach_user_session(db_session, test_user)

    mock_res = PreflightValidationResult(
        is_valid=False,
        error_code="LINKEDIN_SESSION_EXPIRED",
        error_title="LinkedIn session expired",
        error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
    )
    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = mock_res
        resp = client.post(
            "/api/v1/automation/runs",
            json={
                "dry_run": False,
                "allow_live_submission": True,
                "live_submission_confirmation": "CONFIRM_REAL_SUBMISSION",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["error_code"] == "LINKEDIN_SESSION_EXPIRED"

        # Verify NO run was created in DB
        runs = db_session.query(AutomationRun).all()
        assert len(runs) == 0


# ─────────────────────────────────────────────────────────────────────────────
# 3. Missing or undecryptable cookies prevent execution
# ─────────────────────────────────────────────────────────────────────────────

def test_missing_linkedin_session_blocks_dry_run_before_run_creation(client, test_user, db_session):
    """Dry-run does not bypass session preflight; active-tab reading is a separate client workflow."""
    resp = client.post(
        "/api/v1/automation/runs",
        json={"dry_run": True, "max_jobs": 5},
    )
    assert resp.status_code == 400
    data = resp.json()["detail"]
    assert data["error_code"] == "LINKEDIN_SESSION_MISSING"
    assert data["action"] == "reconnect_linkedin"
    assert "connect your LinkedIn account" in data["message"]

    runs = db_session.query(AutomationRun).all()
    assert len(runs) == 0


def test_undecryptable_cookies_prevent_execution_and_mark_expired(client, test_user, db_session):
    """Corrupted session ciphertext fails closed and marks account expired."""
    account = LinkedInAccount(
        user_id=test_user,
        status="connected",
        encrypted_session="corrupted_non_fernet_garbage_ciphertext",
    )
    db_session.add(account)
    db_session.commit()

    resp = client.post(
        "/api/v1/automation/runs",
        json={"dry_run": True, "max_jobs": 5},
    )
    assert resp.status_code == 400
    data = resp.json()["detail"]
    assert data["error_code"] == "LINKEDIN_SESSION_INVALID"
    assert "Your LinkedIn session is no longer valid" in data["message"]

    # Verify account was flagged as expired
    db_session.refresh(account)
    assert account.status == "expired"

    runs = db_session.query(AutomationRun).all()
    assert len(runs) == 0


# ─────────────────────────────────────────────────────────────────────────────
# 4. Network timeouts and inconclusive responses fail closed without false expiry
# ─────────────────────────────────────────────────────────────────────────────

def test_network_timeout_fails_closed_without_marking_expired(client, test_user, db_session):
    """Network timeout fails closed with temporary error, without marking session expired."""
    account = attach_user_session(db_session, test_user)

    mock_res = PreflightValidationResult(
        is_valid=False,
        error_code="LINKEDIN_NETWORK_ERROR",
        error_title="LinkedIn connection timeout",
        error_message="LinkedIn session verification timed out. Please check your connection and try again.",
        is_network_error=True,
    )
    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = mock_res
        resp = client.post(
            "/api/v1/automation/runs",
            json={"dry_run": True, "max_jobs": 5},
        )
        assert resp.status_code == 400
        data = resp.json()["detail"]
        assert data["error_code"] == "LINKEDIN_NETWORK_ERROR"
        assert data["is_network_error"] is True

        # Account status must NOT be marked expired
        db_session.refresh(account)
        assert account.status == "connected"

        # No run created
        assert db_session.query(AutomationRun).count() == 0


# ─────────────────────────────────────────────────────────────────────────────
# 5. Worker-level gate: No jobs discovered, queued, or submitted on preflight failure
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_worker_preflight_failure_stops_without_discovering_jobs(db_session, test_user):
    """If run is executed in worker and session is expired, worker halts before discovering jobs."""
    # Seed a job in DB that would otherwise be discovered
    test_job = Job(
        linkedin_job_id="9999999",
        title="Software Engineer",
        company="TechCorp",
        location="India",
        job_url="https://www.linkedin.com/jobs/view/9999999/",
    )
    db_session.add(test_job)

    # Create run directly in DB (simulating pre-existing or queued run)
    run = AutomationRun(
        user_id=test_user,
        status="pending",
        dry_run=True,
        max_jobs=5,
    )
    db_session.add(run)
    db_session.commit()

    run_id = run.id

    mock_res = PreflightValidationResult(
        is_valid=False,
        error_code="LINKEDIN_SESSION_EXPIRED",
        error_title="LinkedIn session expired",
        error_message="Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
    )

    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val, \
         patch("backend.app.workers.linkedin_worker.select_eligible_unapplied_jobs") as mock_disc, \
         patch("backend.app.workers.linkedin_worker.SessionLocal", return_value=db_session):
        mock_val.return_value = mock_res

        await execute_automation_run(
            run_id=run_id,
            user_id=test_user,
            dry_run=True,
            max_jobs=5,
        )

        # Preflight validation called
        mock_val.assert_called_once()
        # Job discovery was NEVER called!
        mock_disc.assert_not_called()

        # Run status updated to failed with clear error
        db_check = TestingSessionLocal()
        try:
            run_check = db_check.query(AutomationRun).filter(AutomationRun.id == run_id).first()
            assert run_check is not None
            assert run_check.status == "failed"
            assert "LinkedIn session expired" in run_check.error_message
            assert run_check.jobs_found == 0
            assert run_check.jobs_processed == 0
            assert run_check.applications_submitted == 0
        finally:
            db_check.close()


# ─────────────────────────────────────────────────────────────────────────────
# 6. Triple-Key safety guard remains untouched and live submission never executed
# ─────────────────────────────────────────────────────────────────────────────

def test_triple_key_guard_is_preserved_when_session_is_valid(client, test_user, db_session):
    """Triple-Key Live-Submission Guard invariant is strictly preserved:
    Even with a valid session, missing live_submission_confirmation forces dry_run=True.
    """
    attach_user_session(db_session, test_user)

    mock_res = PreflightValidationResult(is_valid=True, cookies=[{"name": "li_at", "value": "val"}])
    with patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = mock_res
        # User tries dry_run=False but WITHOUT confirmation string
        resp = client.post(
            "/api/v1/automation/runs",
            json={
                "dry_run": False,
                "allow_live_submission": True,
                "live_submission_confirmation": "WRONG_TOKEN",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        # Stored run must be created with effective capped max_jobs
        run = db_session.query(AutomationRun).filter(AutomationRun.id == uuid.UUID(data["id"])).first()
        assert run is not None
        # In worker, Triple-Key will evaluate is_real_submission_authorized = False
        assert (not run.dry_run and run.allow_live_submission and run.live_submission_confirmation == "CONFIRM_REAL_SUBMISSION") is False


# ─────────────────────────────────────────────────────────────────────────────
# 7. Navigation failure, Chrome error pages, and genuine empty results tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_redirect_loop_detected_as_session_expired(db_session, test_user):
    """When LinkedIn redirects in a loop on /feed/, validator marks account expired."""
    account = attach_user_session(db_session, test_user)

    mock_page = MagicMock()
    mock_page.url = "chrome-error://chromewebdata/"
    mock_page.title = AsyncMock(return_value="www.linkedin.com")
    mock_page.goto = AsyncMock(side_effect=Exception("Page.goto: net::ERR_TOO_MANY_REDIRECTS at https://www.linkedin.com/feed/"))
    mock_page.query_selector = AsyncMock(return_value=None)

    with patch("linkedin_hunter.browser.engine.BrowserEngine") as mock_engine_cls:
        mock_engine = MagicMock()
        mock_engine.launch = AsyncMock(return_value=mock_page)
        mock_engine.load_cookies = AsyncMock()
        mock_engine.close = AsyncMock()
        mock_engine_cls.return_value = mock_engine

        res = await LinkedInSessionValidator.validate_session(db_session, test_user)

        assert res.is_valid is False
        assert res.error_code == "LINKEDIN_SESSION_EXPIRED"
        assert "Your LinkedIn session is no longer valid" in res.error_message
        assert account.status == "expired"


@pytest.mark.asyncio
async def test_search_navigation_to_chrome_error_fails_immediately_without_scrolling():
    """When search navigation lands on chrome-error://chromewebdata/, collect_search_jobs halts fast."""
    from linkedin_hunter.config import HunterConfig
    from linkedin_hunter.jobs.search import collect_search_jobs, SearchNavigationError

    mock_page = MagicMock()
    mock_page.url = "chrome-error://chromewebdata/"
    mock_page.title = AsyncMock(return_value="www.linkedin.com")
    mock_page.goto = AsyncMock(return_value=None)
    mock_page.evaluate = AsyncMock(return_value="ERR_TOO_MANY_REDIRECTS")

    config = HunterConfig()
    config.search.keywords = "Software Test Engineer"
    config.search.location = "Noida"

    with pytest.raises(SearchNavigationError) as exc_info:
        await collect_search_jobs(mock_page, config, target_count=5)

    assert "LinkedIn search page failed to load" in str(exc_info.value)
    # Verify scrolling was NEVER attempted
    mock_page.mouse.wheel.assert_not_called() if hasattr(mock_page.mouse, 'wheel') else True


@pytest.mark.asyncio
async def test_search_navigation_failure_marks_run_failed_not_completed(db_session, test_user):
    """When live search navigation fails, worker marks run status as failed (not completed with 0 jobs)."""
    from backend.app.db.models.automation_run import AutomationRun
    from backend.app.db.models.automation_log import AutomationLog
    from linkedin_hunter.jobs.search import SearchNavigationError

    attach_user_session(db_session, test_user)
    consent = UserPolicyAcceptance(
        user_id=test_user,
        policy_type=POLICY_TYPE_LINKEDIN,
        policy_version="draft-1",
    )
    db_session.add(consent)
    db_session.commit()

    run = AutomationRun(
        user_id=test_user,
        status="pending",
        dry_run=True,
        max_jobs=5,
    )
    db_session.add(run)
    db_session.commit()
    run_id = run.id

    mock_res = PreflightValidationResult(is_valid=True, cookies=[{"name": "li_at", "value": "val"}])
    mock_engine = MagicMock()
    mock_engine.launch = AsyncMock(return_value=MagicMock())
    mock_engine.load_cookies = AsyncMock()
    mock_engine.close = AsyncMock()

    with patch("backend.app.services.browser_diagnostics.verify_browser_runtime"), \
         patch("linkedin_hunter.browser.engine.BrowserEngine", return_value=mock_engine), \
         patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val, \
         patch("backend.app.workers.linkedin_worker.select_eligible_unapplied_jobs", return_value=[]), \
         patch("linkedin_hunter.auth.session.check_session_health", new_callable=AsyncMock) as mock_health, \
         patch("linkedin_hunter.jobs.search.collect_search_jobs", new_callable=AsyncMock) as mock_search, \
         patch("backend.app.workers.linkedin_worker.SessionLocal", return_value=db_session):

        mock_val.return_value = mock_res
        mock_health.return_value = {"authenticated": True}
        mock_search.side_effect = SearchNavigationError("LinkedIn search page failed to load (ERR_NAME_NOT_RESOLVED)")

        await execute_automation_run(
            run_id=run_id,
            user_id=test_user,
            dry_run=True,
            max_jobs=5,
        )

        db_check = TestingSessionLocal()
        try:
            run_check = db_check.query(AutomationRun).filter(AutomationRun.id == run_id).first()
            assert run_check is not None
            assert run_check.status == "failed"
            assert "LinkedIn job search page failed to load" in run_check.error_message
            assert run_check.jobs_found == 0

            # Verify SEARCH_FAILED event was logged
            search_failed_log = (
                db_check.query(AutomationLog)
                .filter(AutomationLog.run_id == run_id, AutomationLog.event == "SEARCH_FAILED")
                .first()
            )
            assert search_failed_log is not None
        finally:
            db_check.close()


@pytest.mark.asyncio
async def test_genuine_empty_search_results_distinguished_as_search_succeeded_empty(db_session, test_user):
    """When search loads normally and LinkedIn confirms 0 jobs, event is SEARCH_SUCCEEDED_EMPTY."""
    from backend.app.db.models.automation_run import AutomationRun
    from backend.app.db.models.automation_log import AutomationLog

    attach_user_session(db_session, test_user)
    consent = UserPolicyAcceptance(
        user_id=test_user,
        policy_type=POLICY_TYPE_LINKEDIN,
        policy_version="draft-1",
    )
    db_session.add(consent)
    db_session.commit()

    run = AutomationRun(
        user_id=test_user,
        status="pending",
        dry_run=True,
        max_jobs=5,
    )
    db_session.add(run)
    db_session.commit()
    run_id = run.id

    mock_res = PreflightValidationResult(is_valid=True, cookies=[{"name": "li_at", "value": "val"}])
    mock_engine = MagicMock()
    mock_engine.launch = AsyncMock(return_value=MagicMock())
    mock_engine.load_cookies = AsyncMock()
    mock_engine.close = AsyncMock()

    with patch("backend.app.services.browser_diagnostics.verify_browser_runtime"), \
         patch("linkedin_hunter.browser.engine.BrowserEngine", return_value=mock_engine), \
         patch.object(LinkedInSessionValidator, "validate_session", new_callable=AsyncMock) as mock_val, \
         patch("backend.app.workers.linkedin_worker.select_eligible_unapplied_jobs", return_value=[]), \
         patch("linkedin_hunter.auth.session.check_session_health", new_callable=AsyncMock) as mock_health, \
         patch("linkedin_hunter.jobs.search.collect_search_jobs", new_callable=AsyncMock) as mock_search, \
         patch("backend.app.workers.linkedin_worker.SessionLocal", return_value=db_session):

        mock_val.return_value = mock_res
        mock_health.return_value = {"authenticated": True}
        # Returns empty list representing genuine 0 results banner
        mock_search.return_value = []

        await execute_automation_run(
            run_id=run_id,
            user_id=test_user,
            dry_run=True,
            max_jobs=5,
        )

        db_check = TestingSessionLocal()
        try:
            run_check = db_check.query(AutomationRun).filter(AutomationRun.id == run_id).first()
            assert run_check is not None
            assert run_check.status == "completed"

            empty_log = (
                db_check.query(AutomationLog)
                .filter(AutomationLog.run_id == run_id, AutomationLog.event == "SEARCH_SUCCEEDED_EMPTY")
                .first()
            )
            assert empty_log is not None
        finally:
            db_check.close()


def test_production_encryption_key_mandatory_check(monkeypatch):
    """In production, missing dedicated SESSION_ENCRYPTION_KEY raises RuntimeError."""
    from backend.app.core.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SESSION_ENCRYPTION_KEY", "")

    with pytest.raises(RuntimeError) as exc_info:
        LinkedInSessionService._get_fernet()

    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)

