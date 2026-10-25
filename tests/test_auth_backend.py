"""Backend security and user-level data isolation tests for Supabase Authentication."""

import uuid
from datetime import datetime, timezone
import jwt
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app
from tests.conftest import TEST_SECRET, USER_A_ID, USER_B_ID, create_test_token

client = TestClient(app)


def test_public_health_endpoints_accessible():
    """Public endpoints should not require authentication."""
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.json() == {"status": "ok"}

    r2 = client.get("/health/db")
    assert r2.status_code == 200


def test_missing_token_returns_401():
    """Protected endpoints must reject requests without an Authorization header."""
    r = client.get("/api/v1/profile")
    assert r.status_code == 401
    assert "detail" in r.json()


def test_malformed_token_returns_401():
    """Invalid bearer token formats must be rejected with 401."""
    r = client.get("/api/v1/profile", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert r.status_code == 401


def test_expired_token_returns_401():
    """Expired JWT tokens must be rejected."""
    expired_payload = {
        "sub": str(USER_A_ID),
        "aud": "authenticated",
        "role": "authenticated",
        "email": "user_a@example.com",
        "exp": int(datetime.now(timezone.utc).timestamp()) - 3600,  # 1 hour in the past
    }
    expired_token = jwt.encode(expired_payload, TEST_SECRET, algorithm="HS256")
    r = client.get("/api/v1/profile", headers={"Authorization": f"Bearer {expired_token}"})
    assert r.status_code == 401
    assert "expired" in r.json().get("detail", "").lower()


def test_invalid_signature_returns_401():
    """Tokens signed with a different key must be rejected."""
    wrong_payload = {
        "sub": str(USER_A_ID),
        "aud": "authenticated",
        "role": "authenticated",
        "email": "user_a@example.com",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    wrong_token = jwt.encode(wrong_payload, "completely-wrong-secret-key-1234567890", algorithm="HS256")
    r = client.get("/api/v1/profile", headers={"Authorization": f"Bearer {wrong_token}"})
    assert r.status_code == 401


def test_user_data_isolation():
    """User A cannot access or overwrite User B's profile or private resources."""
    token_a = create_test_token(USER_A_ID)
    token_b = create_test_token(USER_B_ID)

    # 1. User A updates their profile
    patch_a = client.patch(
        "/api/v1/profile",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"first_name": "Alice", "city": "Seattle"},
    )
    assert patch_a.status_code == 200
    assert patch_a.json()["first_name"] == "Alice"

    # 2. User B updates their profile
    patch_b = client.patch(
        "/api/v1/profile",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"first_name": "Bob", "city": "Austin"},
    )
    assert patch_b.status_code == 200
    assert patch_b.json()["first_name"] == "Bob"

    # 3. User A reads profile -> receives Alice, never Bob
    get_a = client.get("/api/v1/profile", headers={"Authorization": f"Bearer {token_a}"})
    assert get_a.status_code == 200
    assert get_a.json()["first_name"] == "Alice"
    assert get_a.json()["city"] == "Seattle"

    # 4. User B reads profile -> receives Bob, never Alice
    get_b = client.get("/api/v1/profile", headers={"Authorization": f"Bearer {token_b}"})
    assert get_b.status_code == 200
    assert get_b.json()["first_name"] == "Bob"
    assert get_b.json()["city"] == "Austin"
