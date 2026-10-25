"""Tests for LinkedIn connection, session encryption, permission consent, and lifecycle."""

import uuid
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.security import get_current_user_id
from backend.app.db.database import Base, get_db
from backend.app.db.models.linkedin_account import LinkedInAccount
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.profile import Profile
from backend.app.main import app
from backend.app.services.linkedin_session_service import (
    LinkedInSessionService,
    POLICY_TYPE_LINKEDIN,
    DEFAULT_CONSENT_VERSION,
)

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
        email="testcandidate@example.com",
        first_name="Test",
        last_name="Candidate",
    )
    db_session.add(profile)
    # Also record general platform policy acceptance so policy dependency passes
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


def test_encryption_roundtrip():
    """Verify cookies are strongly encrypted and cleanly decrypted."""
    token = "AQEDAS_TestCookieVal1234567890"
    encrypted = LinkedInSessionService.encrypt_session(token)
    assert encrypted != token
    assert "TestCookieVal" not in encrypted

    decrypted = LinkedInSessionService.decrypt_session(encrypted)
    assert isinstance(decrypted, list)
    assert len(decrypted) == 1
    assert decrypted[0]["name"] == "li_at"
    assert decrypted[0]["value"] == token
    assert decrypted[0]["domain"] == ".linkedin.com"


def test_missing_li_at_raises_error():
    """Verify submitting invalid session without li_at cookie fails with 400."""
    with pytest.raises(Exception):
        LinkedInSessionService.encrypt_session([{"name": "random_cookie", "value": "123"}])


def test_initial_status_disconnected(client, test_user):
    """New user with no LinkedIn connection returns disconnected and no consent."""
    resp = client.get("/api/v1/linkedin/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_connected"] is False
    assert data["status"] == "disconnected"
    assert data["has_consent"] is False
    assert data["consent_version"] is None


def test_connect_session_and_persist(client, test_user, db_session):
    """Connecting session encrypts credentials and marks status connected."""
    payload = {
        "session_token": "AQEDAS_SampleSessionCookieVal999",
        "linkedin_profile_url": "https://www.linkedin.com/in/testcandidate",
    }
    resp = client.post("/api/v1/linkedin/connect", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_connected"] is True
    assert data["status"] == "connected"
    assert data["linkedin_profile_url"] == "https://www.linkedin.com/in/testcandidate"

    # Verify database record does NOT store plaintext token
    account = db_session.query(LinkedInAccount).filter_by(user_id=test_user).first()
    assert account is not None
    assert account.status == "connected"
    assert "AQEDAS_SampleSessionCookieVal999" not in account.encrypted_session


def test_consent_lifecycle(client, test_user, db_session):
    """Submitting consent records consent in user_policy_acceptances."""
    # First submit invalid consent
    bad_resp = client.post("/api/v1/linkedin/consent", json={"accepted": False, "policy_version": "v1.0"})
    assert bad_resp.status_code == 400

    # Submit valid consent
    resp = client.post("/api/v1/linkedin/consent", json={"accepted": True, "policy_version": "v1.0"})
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["success"] is True
    assert res_data["policy_version"] == "v1.0"

    # Verify status now shows has_consent=True
    status_resp = client.get("/api/v1/linkedin/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["has_consent"] is True
    assert status_resp.json()["consent_version"] == "v1.0"


def test_disconnect_wipes_session(client, test_user, db_session):
    """Disconnecting securely removes encrypted session and sets disconnected state."""
    # Connect first
    client.post("/api/v1/linkedin/connect", json={"session_token": "AQEDAS_SecretToken1234567890"})

    # Now disconnect
    disc_resp = client.post("/api/v1/linkedin/disconnect")
    assert disc_resp.status_code == 200
    assert disc_resp.json()["status"] == "disconnected"

    # Check status
    status_resp = client.get("/api/v1/linkedin/status")
    assert status_resp.json()["is_connected"] is False
    assert status_resp.json()["status"] == "disconnected"

    account = db_session.query(LinkedInAccount).filter_by(user_id=test_user).first()
    assert account.encrypted_session is None


def test_revoke_consent(client, test_user, db_session):
    """Revoking consent wipes both consent and session records."""
    client.post("/api/v1/linkedin/connect", json={"session_token": "AQEDAS_Token1234567890"})
    client.post("/api/v1/linkedin/consent", json={"accepted": True, "policy_version": "v1.0"})

    # Revoke
    rev_resp = client.post("/api/v1/linkedin/revoke-consent")
    assert rev_resp.status_code == 200

    status_resp = client.get("/api/v1/linkedin/status")
    assert status_resp.json()["has_consent"] is False
    assert status_resp.json()["is_connected"] is False


def test_user_session_isolation(db_session):
    """Ensure user A cannot access or decrypt user B's LinkedIn session."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()

    db_session.add(Profile(id=user_a, email="usera@example.com"))
    db_session.add(Profile(id=user_b, email="userb@example.com"))
    db_session.commit()

    token_a = "AQEDAS_UserAToken1234567890"
    LinkedInSessionService.save_session(db_session, user_a, token_a)

    status_b = LinkedInSessionService.get_status(db_session, user_b)
    assert status_b["is_connected"] is False
    assert status_b["status"] == "disconnected"


def test_production_encryption_key_safety(monkeypatch):
    """Verify production fails fast and prohibits fallback encryption keys if secrets are missing."""
    from backend.app.core.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SESSION_ENCRYPTION_KEY", None)
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")

    with pytest.raises(RuntimeError) as exc_info:
        LinkedInSessionService._get_fernet()

    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)
    assert "strictly forbidden" in str(exc_info.value)


def test_dedicated_encryption_key_used(monkeypatch):
    """Verify dedicated SESSION_ENCRYPTION_KEY is used when configured."""
    from backend.app.core.config import settings

    custom_key = "a_very_strong_dedicated_production_key_32bytes"
    monkeypatch.setattr(settings, "SESSION_ENCRYPTION_KEY", custom_key)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    fernet = LinkedInSessionService._get_fernet()
    assert fernet is not None
