"""Backend tests for Platform Policy Acceptance and Consent Tracking."""

import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app
from tests.conftest import client, create_test_token, USER_A_ID, USER_B_ID, USER_UNACCEPTED_ID


def test_policy_status_unauthenticated_returns_401():
    """Unauthenticated request to policy status must be rejected with 401."""
    r = client.get("/api/v1/policy/acceptance-status")
    assert r.status_code == 401


def test_policy_accept_unauthenticated_returns_401():
    """Unauthenticated request to accept policy must be rejected with 401."""
    r = client.post("/api/v1/policy/accept", json={})
    assert r.status_code == 401


def test_unaccepted_user_gets_403_on_protected_endpoints():
    """User who has not accepted policy must receive 403 Forbidden on protected features."""
    unaccepted_token = create_test_token(USER_UNACCEPTED_ID)
    headers = {"Authorization": f"Bearer {unaccepted_token}"}

    # Protected features should be blocked
    for path in (
        "/api/v1/profile",
        "/api/v1/resumes",
        "/api/v1/search-configs",
        "/api/v1/jobs",
        "/api/v1/applications",
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 403, (path, response.json())
        assert "policy" in response.json()["detail"].lower()


def test_policy_status_returns_has_accepted_false_for_unaccepted_user():
    """Status endpoint must report has_accepted: False for unaccepted user."""
    unaccepted_token = create_test_token(USER_UNACCEPTED_ID)
    headers = {"Authorization": f"Bearer {unaccepted_token}"}

    r = client.get("/api/v1/policy/acceptance-status", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["has_accepted"] is False
    assert data["required_version"] == settings.ACTIVE_POLICY_VERSION
    assert data["accepted_version"] is None
    assert data["accepted_at"] is None


def test_user_accepts_policy_and_unlocks_endpoints():
    """User accepts policy; status becomes true and protected endpoints unlock."""
    user_new_id = uuid.uuid4()
    token = create_test_token(user_new_id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initially blocked
    r_before = client.get("/api/v1/profile", headers=headers)
    assert r_before.status_code == 403

    # 2. Accept active policy
    r_accept = client.post(
        "/api/v1/policy/accept",
        headers=headers,
        json={"policy_type": settings.ACTIVE_POLICY_TYPE, "policy_version": settings.ACTIVE_POLICY_VERSION},
    )
    assert r_accept.status_code == 200
    accept_data = r_accept.json()
    assert accept_data["success"] is True
    assert accept_data["policy_version"] == settings.ACTIVE_POLICY_VERSION
    assert accept_data["accepted_at"] is not None

    # 3. Status is now accepted
    r_status = client.get("/api/v1/policy/acceptance-status", headers=headers)
    assert r_status.status_code == 200
    assert r_status.json()["has_accepted"] is True
    assert r_status.json()["accepted_version"] == settings.ACTIVE_POLICY_VERSION

    # 4. Protected endpoints are now accessible
    r_after = client.get("/api/v1/profile", headers=headers)
    assert r_after.status_code == 200
    assert r_after.json()["id"] == str(user_new_id)

    # The same acceptance unlocks each API called during profile initialization.
    assert client.get("/api/v1/resumes", headers=headers).status_code == 200
    assert client.get("/api/v1/search-configs", headers=headers).status_code == 200


def test_idempotent_accept_does_not_duplicate():
    """Repeated accept requests for the same version succeed idempotently without creating duplicate records."""
    user_id = uuid.uuid4()
    token = create_test_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    r1 = client.post("/api/v1/policy/accept", headers=headers, json={})
    assert r1.status_code == 200
    first_accepted_at = r1.json()["accepted_at"]

    r2 = client.post("/api/v1/policy/accept", headers=headers, json={})
    assert r2.status_code == 200
    assert r2.json()["accepted_at"] == first_accepted_at


def test_invalid_policy_version_returns_400():
    """Submitting an invalid or obsolete policy version is rejected."""
    user_id = uuid.uuid4()
    token = create_test_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    r = client.post(
        "/api/v1/policy/accept",
        headers=headers,
        json={"policy_version": "non-existent-version-999"},
    )
    assert r.status_code == 400
    assert "invalid policy version" in r.json()["detail"].lower()


def test_cross_user_policy_isolation():
    """One user accepting policy does not grant access to another unaccepted user."""
    user_1 = uuid.uuid4()
    user_2 = uuid.uuid4()

    token_1 = create_test_token(user_1)
    token_2 = create_test_token(user_2)

    # User 1 accepts
    client.post("/api/v1/policy/accept", headers={"Authorization": f"Bearer {token_1}"}, json={})

    # User 2 is still unaccepted and blocked
    r2_status = client.get("/api/v1/policy/acceptance-status", headers={"Authorization": f"Bearer {token_2}"})
    assert r2_status.json()["has_accepted"] is False

    r2_profile = client.get("/api/v1/profile", headers={"Authorization": f"Bearer {token_2}"})
    assert r2_profile.status_code == 403


def test_new_policy_version_requires_reacceptance(monkeypatch):
    """When a new policy version becomes active, users with old acceptance are prompted again."""
    user_id = uuid.uuid4()
    token = create_test_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Accept draft-1
    client.post("/api/v1/policy/accept", headers=headers, json={"policy_version": "draft-1"})
    assert client.get("/api/v1/profile", headers=headers).status_code == 200

    # Simulate platform policy bump to draft-2
    monkeypatch.setattr(settings, "ACTIVE_POLICY_VERSION", "draft-2")

    # Now user is unaccepted for draft-2
    r_status = client.get("/api/v1/policy/acceptance-status", headers=headers)
    assert r_status.json()["has_accepted"] is False
    assert r_status.json()["required_version"] == "draft-2"
    assert r_status.json()["accepted_version"] == "draft-1"

    # Protected features blocked until draft-2 is accepted
    r_profile = client.get("/api/v1/profile", headers=headers)
    assert r_profile.status_code == 403


def test_cors_options_preflight_production_frontend():
    """OPTIONS preflight for production frontend https://rolepilot-frontend-phi.vercel.app succeeds."""
    r = client.options(
        "/api/v1/policy/accept",
        headers={
            "Origin": "https://rolepilot-frontend-phi.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "https://rolepilot-frontend-phi.vercel.app"
    assert r.headers.get("access-control-allow-credentials") == "true"


def test_cors_options_preflight_localhost_development():
    """OPTIONS preflight for localhost development origins succeeds."""
    for origin in ("http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"):
        r = client.options(
            "/api/v1/policy/acceptance-status",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == origin
        assert r.headers.get("access-control-allow-credentials") == "true"


def test_cors_options_preflight_vercel_preview_domains():
    """OPTIONS preflight for Vercel preview environments succeeds via regex matching."""
    preview_origin = "https://rolepilot-frontend-branch-test.vercel.app"
    r = client.options(
        "/api/v1/policy/accept",
        headers={
            "Origin": preview_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == preview_origin


def test_cors_options_preflight_disallows_unauthorized_origin():
    """OPTIONS preflight for unknown external origins is rejected."""
    r = client.options(
        "/api/v1/policy/accept",
        headers={
            "Origin": "https://malicious-site.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert r.status_code == 400


def test_cors_origins_setting_assembler():
    """Settings assemble_cors_origins correctly handles strings, lists, and preserves required origins."""
    from backend.app.core.config import Settings

    # Even if environment specifies single custom origin or JSON string
    s_json = Settings(CORS_ORIGINS='["https://custom-origin.com"]')
    assert "https://rolepilot-frontend-phi.vercel.app" in s_json.CORS_ORIGINS
    assert "https://custom-origin.com" in s_json.CORS_ORIGINS
    assert "http://localhost:3000" in s_json.CORS_ORIGINS

    # Wildcards must be stripped to prevent credentialed CORS rejection
    s_wildcard = Settings(CORS_ORIGINS='*')
    assert "*" not in s_wildcard.CORS_ORIGINS
    assert "https://rolepilot-frontend-phi.vercel.app" in s_wildcard.CORS_ORIGINS

