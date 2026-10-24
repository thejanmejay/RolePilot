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

USER_A_ID = uuid.UUID("a0000000-0000-0000-0000-000000000001")
USER_B_ID = uuid.UUID("b0000000-0000-0000-0000-000000000002")


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
