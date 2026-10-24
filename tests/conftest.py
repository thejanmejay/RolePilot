"""Shared pytest configuration, database fixtures, and authentication tokens."""

import io
import uuid
from datetime import datetime, timezone

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import settings
from backend.app.db.database import Base, get_db
import backend.app.db.models  # noqa: F401
from backend.app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(bind=test_engine)

USER_A_ID = uuid.UUID("a0000000-0000-0000-0000-000000000001")
USER_B_ID = uuid.UUID("b0000000-0000-0000-0000-000000000002")
USER_UNACCEPTED_ID = uuid.UUID("c0000000-0000-0000-0000-000000000003")

# Pre-seed policy acceptances for test users A and B
with TestingSessionLocal() as db_session:
    from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
    from backend.app.db.models.profile import Profile
    for uid in (USER_A_ID, USER_B_ID):
        if not db_session.get(Profile, uid):
            db_session.add(Profile(id=uid, email=f"user_{uid}@example.com"))
        existing_acc = db_session.query(UserPolicyAcceptance).filter_by(
            user_id=uid,
            policy_type=settings.ACTIVE_POLICY_TYPE,
            policy_version=settings.ACTIVE_POLICY_VERSION,
        ).first()
        if not existing_acc:
            db_session.add(UserPolicyAcceptance(
                id=uuid.uuid4(),
                user_id=uid,
                policy_type=settings.ACTIVE_POLICY_TYPE,
                policy_version=settings.ACTIVE_POLICY_VERSION,
                accepted_at=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
            ))
    db_session.commit()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

TEST_SECRET = "test-super-secure-secret-key-for-jwt-signing-1234567890"
settings.SUPABASE_JWT_SECRET = TEST_SECRET

client = TestClient(app)


def create_test_token(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "aud": "authenticated",
        "role": "authenticated",
        "email": f"user_{user_id}@example.com",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture
def auth_headers_user_a():
    token = create_test_token(USER_A_ID)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_user_b():
    token = create_test_token(USER_B_ID)
    return {"Authorization": f"Bearer {token}"}
