"""Regression tests for LinkedIn session-health validation in cloud environments.

Proves that:
1. Sessions injected from the database into Playwright browser context pass health check
   WITHOUT requiring a local 'data/cookies.json' file on disk (reproducing & fixing the cloud failure).
2. Missing or expired cookies fail safely without crashing.
3. Login redirects, authwalls, and security checkpoints are correctly caught.
4. Cookie presence alone is NOT treated as proof of authentication (multi-signal verification).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from linkedin_hunter.auth.session import check_session_health, has_valid_session


@pytest.fixture
def mock_cloud_environment(monkeypatch):
    """Simulate cloud container where no data/cookies.json exists on disk."""
    monkeypatch.setattr("linkedin_hunter.auth.session.load_cookies", lambda: None)


@pytest.mark.asyncio
async def test_cloud_environment_without_cookie_file_passes_when_injected(mock_cloud_environment):
    """In cloud (no local cookie file), injected browser context cookies pass health check."""
    mock_page = MagicMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.title = AsyncMock(return_value="LinkedIn Feed")

    # Browser context has the injected database session
    injected_cookies = [{"name": "li_at", "value": "AQEDAS_ValidDbInjectedSession123", "domain": ".linkedin.com"}]
    mock_page.context.cookies = AsyncMock(return_value=injected_cookies)

    # Mock DOM query selector finding global nav
    async def mock_query_selector(selector):
        if "global-nav" in selector:
            return MagicMock()
        return None

    mock_page.query_selector = AsyncMock(side_effect=mock_query_selector)

    # Validate health check without local cookies.json
    health = await check_session_health(mock_page)

    assert health["session_available"] is True
    assert health["authenticated"] is True
    assert health["login_redirect"] is False
    assert health["checkpoint_detected"] is False
    assert "Authenticated session verified" in health["details"]


@pytest.mark.asyncio
async def test_cloud_environment_without_cookie_file_and_no_injected_cookie_fails_safely(mock_cloud_environment):
    """In cloud (no local cookie file) and no injected cookie, safely reports session unavailable."""
    mock_page = MagicMock()
    mock_page.context.cookies = AsyncMock(return_value=[])

    health = await check_session_health(mock_page)

    assert health["session_available"] is False
    assert health["authenticated"] is False
    assert "No LinkedIn session cookies found" in health["details"]


@pytest.mark.asyncio
async def test_cookie_presence_alone_is_not_authenticated_if_login_redirect(mock_cloud_environment):
    """Multiple signals required: valid cookie presence must still fail if redirected to login."""
    mock_page = MagicMock()
    # User was redirected to login due to server-side session revocation
    mock_page.url = "https://www.linkedin.com/login?fromSignIn=true"
    mock_page.title = AsyncMock(return_value="LinkedIn: Log In or Sign Up")

    injected_cookies = [{"name": "li_at", "value": "AQEDAS_StaleRevokedSession", "domain": ".linkedin.com"}]
    mock_page.context.cookies = AsyncMock(return_value=injected_cookies)
    mock_page.query_selector = AsyncMock(return_value=None)

    health = await check_session_health(mock_page)

    # Session cookie was available, but page state is NOT authenticated
    assert health["session_available"] is True
    assert health["authenticated"] is False
    assert health["login_redirect"] is True
    assert "Redirected to login page" in health["details"]


@pytest.mark.asyncio
async def test_cookie_presence_fails_if_checkpoint_or_captcha(mock_cloud_environment):
    """Multiple signals required: valid cookie presence must fail if checkpoint/challenge detected."""
    mock_page = MagicMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge/AgF..."
    mock_page.title = AsyncMock(return_value="Security Verification | LinkedIn")

    injected_cookies = [{"name": "li_at", "value": "AQEDAS_SessionUnderVerification", "domain": ".linkedin.com"}]
    mock_page.context.cookies = AsyncMock(return_value=injected_cookies)

    async def mock_query_selector(selector):
        if "captcha" in selector or "checkpoint" in selector:
            return MagicMock()
        return None

    mock_page.query_selector = AsyncMock(side_effect=mock_query_selector)

    health = await check_session_health(mock_page)

    assert health["session_available"] is True
    assert health["authenticated"] is False
    assert health["checkpoint_detected"] is True
    assert "Checkpoint / Challenge detected" in health["details"]


def test_has_valid_session_supports_direct_cookies_without_disk_read(mock_cloud_environment):
    """has_valid_session evaluates in-memory cookie list without needing disk read."""
    valid_cookies = [{"name": "li_at", "value": "valid_token_123"}]
    invalid_cookies = [{"name": "other_cookie", "value": "xyz"}]
    empty_token = [{"name": "li_at", "value": "   "}]

    assert has_valid_session(valid_cookies) is True
    assert has_valid_session(invalid_cookies) is False
    assert has_valid_session(empty_token) is False
    assert has_valid_session([]) is False
    # None triggers fallback to load_cookies which returns None in cloud mock
    assert has_valid_session(None) is False
