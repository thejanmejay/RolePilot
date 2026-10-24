"""Backend tests for Candidate Profile Onboarding Flow & Persistence."""

import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app
from tests.conftest import client, create_test_token, USER_A_ID, USER_B_ID, USER_UNACCEPTED_ID


def test_onboarding_unauthenticated_returns_401():
    """Unauthenticated requests to onboarding endpoint must return 401."""
    r = client.post("/api/v1/profile/onboarding", json={
        "headline": "Software Engineer",
        "target_role": "Full Stack Developer",
        "experience_years": 3,
    })
    assert r.status_code == 401


def test_onboarding_unaccepted_policy_returns_403():
    """Users who have not accepted platform policy must receive 403 Forbidden."""
    unaccepted_token = create_test_token(USER_UNACCEPTED_ID)
    headers = {"Authorization": f"Bearer {unaccepted_token}"}

    r = client.post("/api/v1/profile/onboarding", headers=headers, json={
        "headline": "Software Engineer",
        "target_role": "Full Stack Developer",
        "experience_years": 3,
    })
    assert r.status_code == 403
    assert "policy" in r.json()["detail"].lower()


def test_onboarding_validation_error():
    """Invalid onboarding payloads (e.g. negative years or empty title) must return 422."""
    token = create_test_token(USER_A_ID)
    headers = {"Authorization": f"Bearer {token}"}

    # Missing headline & target_role
    r = client.post("/api/v1/profile/onboarding", headers=headers, json={
        "experience_years": -2,
    })
    assert r.status_code == 422


def test_onboarding_completes_successfully_and_persists():
    """Authenticated user with policy accepted can complete initial onboarding and persist status."""
    token = create_test_token(USER_A_ID)
    headers = {"Authorization": f"Bearer {token}"}

    # Submit onboarding
    r = client.post("/api/v1/profile/onboarding", headers=headers, json={
        "full_name": "Jordan Lee",
        "headline": "Senior Full Stack Engineer",
        "target_role": "Lead Software Architect",
        "experience_years": 6,
        "city": "Bengaluru",
        "country": "India",
        "phone": "+91 98765 43210",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["first_name"] == "Jordan"
    assert data["last_name"] == "Lee"
    assert data["headline"] == "Senior Full Stack Engineer"
    assert data["target_role"] == "Lead Software Architect"
    assert data["experience_years"] == 6
    assert data["city"] == "Bengaluru"
    assert data["onboarding_completed"] is True
    assert data["onboarding_completed_at"] is not None

    # Verify retrieval via GET /api/v1/profile confirms persistence
    r_get = client.get("/api/v1/profile", headers=headers)
    assert r_get.status_code == 200
    profile_data = r_get.json()
    assert profile_data["onboarding_completed"] is True
    assert profile_data["headline"] == "Senior Full Stack Engineer"
    assert profile_data["target_role"] == "Lead Software Architect"


def test_returning_user_state_preservation():
    """Returning user profile maintains onboarding_completed across multiple sessions/calls."""
    token = create_test_token(USER_A_ID)
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/api/v1/profile", headers=headers)
    assert r.status_code == 200
    assert r.json()["onboarding_completed"] is True
