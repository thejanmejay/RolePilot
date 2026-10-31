"""Backend unit and integration tests for Resume Parsing, Portfolio Extraction, SSRF Defenses, and Review Application."""

import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.security import get_current_user_id
from backend.app.db.database import Base, get_db
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.profile import Profile
from backend.app.main import app
from backend.app.schemas.profile_extraction import (
    ApplyExtractionRequest,
    ExtractedExperience,
    ExtractedProfileData,
    ExtractedSkill,
)
from backend.app.services.extraction_merger import ExtractionMerger
from backend.app.services.portfolio_extractor import (
    is_private_or_restricted_ip,
    validate_safe_url,
)
from backend.app.services.resume_parser import ResumeParser

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
        email="alex.morgan@example.com",
        first_name="Alex",
        last_name="Morgan",
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
    app.dependency_overrides.pop(get_db, None)


# 1. SSRF & URL Validation Tests
def test_ssrf_rejects_loopback_and_private_ips():
    """Verify private and loopback IPs are blocked by the IP validator."""
    assert is_private_or_restricted_ip("127.0.0.1") is True
    assert is_private_or_restricted_ip("127.0.0.2") is True
    assert is_private_or_restricted_ip("::1") is True
    assert is_private_or_restricted_ip("10.0.0.1") is True
    assert is_private_or_restricted_ip("172.16.0.1") is True
    assert is_private_or_restricted_ip("192.168.1.1") is True
    assert is_private_or_restricted_ip("169.254.169.254") is True  # Cloud metadata IP
    assert is_private_or_restricted_ip("8.8.8.8") is False  # Public Google DNS


def test_ssrf_rejects_unsafe_urls():
    """Verify validate_safe_url raises ValueError on unsafe URLs, schemes, or localhost."""
    with pytest.raises(ValueError, match="Access to localhost or loopback"):
        validate_safe_url("http://localhost:8000/api")

    with pytest.raises(ValueError, match="Access to localhost or loopback"):
        validate_safe_url("http://127.0.0.1/admin")

    with pytest.raises(ValueError, match="Unsupported URL scheme"):
        validate_safe_url("file:///etc/passwd")

    with pytest.raises(ValueError, match="Unsupported URL scheme"):
        validate_safe_url("ftp://ftp.example.com")

    with pytest.raises(ValueError, match="embedded authentication credentials"):
        validate_safe_url("http://admin:secret@example.com")


# 2. Resume Parser Tests
def test_resume_parser_handles_unreadable_or_empty_bytes():
    """Graceful degradation for empty or unreadable document bytes."""
    res = ResumeParser.parse_pdf(b"")
    assert res["is_readable"] is False
    assert len(res["warnings"]) > 0
    assert "Resume appears scanned" in res["warnings"][0]


# 3. Extraction Merger & Conflict Detection Tests
def test_extraction_merger_detects_headline_conflict():
    """Conflicting headlines from resume and portfolio must be flagged for review."""
    resume_data = {
        "is_readable": True,
        "first_name": "Jordan",
        "last_name": "Lee",
        "headline": "Senior Full Stack Engineer",
        "skills": [{"name": "Python", "years": 5}],
    }
    portfolio_data = {
        "headline": "Lead React Developer & Open Source Architect",
        "website_url": "https://jordanlee.dev",
        "skills": [{"name": "React", "years": 4}],
    }

    merged = ExtractionMerger.merge(resume_data, portfolio_data)
    assert len(merged.conflicts) == 1
    assert merged.conflicts[0].field == "headline"
    assert merged.conflicts[0].resume_value == "Senior Full Stack Engineer"
    assert merged.conflicts[0].portfolio_value == "Lead React Developer & Open Source Architect"
    assert len(merged.skills) == 2
    assert merged.profile.first_name == "Jordan"
    assert merged.profile.website_url == "https://jordanlee.dev"


# 4. API Endpoint Integration Tests
def test_apply_extraction_saves_profile_and_completes_onboarding(client, test_user, db_session):
    """Applying confirmed extraction results saves skills, experiences, and sets onboarding_completed."""
    payload = ApplyExtractionRequest(
        profile=ExtractedProfileData(
            first_name="Devon",
            last_name="Vance",
            headline="Principal SDET",
            target_role="Staff Test Architect",
            experience_years=8,
            city="Bengaluru",
            country="India",
            phone="+91 99999 88888",
        ),
        skills=[
            ExtractedSkill(name="Playwright", years=4, months=0, source="resume"),
            ExtractedSkill(name="Python", years=6, months=0, source="resume"),
        ],
        experiences=[
            ExtractedExperience(
                company_name="Acme Corp",
                job_title="Lead Automation Engineer",
                start_date="2020-01-01",
                end_date="2023-01-01",
                source="resume",
            )
        ],
        educations=[],
        complete_onboarding=True,
    )

    resp = client.post("/api/v1/profile/apply-extraction", json=payload.model_dump())
    assert resp.status_code == 200
    data = resp.json()

    assert data["first_name"] == "Devon"
    assert data["last_name"] == "Vance"
    assert data["headline"] == "Principal SDET"
    assert data["target_role"] == "Staff Test Architect"
    assert data["experience_years"] == 8
    assert data["onboarding_completed"] is True
    assert len(data["skills"]) >= 2
    assert len(data["experiences"]) >= 1


def test_extraction_requires_at_least_one_source(client):
    """Calling extract without resume or portfolio URL must return 400."""
    resp = client.post("/api/v1/profile/extract")
    assert resp.status_code == 400
    assert "Please provide at least a resume file or a portfolio URL" in resp.json()["detail"]


def test_ssrf_rejects_ipv4_mapped_and_6to4_addresses():
    """Verify that IPv4-mapped IPv6 addresses and 6to4 tunneling addresses are rejected."""
    # IPv4-mapped loopback and private addresses
    assert is_private_or_restricted_ip("::ffff:127.0.0.1") is True
    assert is_private_or_restricted_ip("::ffff:10.0.0.1") is True
    assert is_private_or_restricted_ip("::ffff:169.254.169.254") is True
    assert is_private_or_restricted_ip("::ffff:192.168.1.1") is True

    # 6to4 prefix with embedded private IPv4 10.0.0.1 (0x0A000001)
    assert is_private_or_restricted_ip("2002:0a00:0001::") is True

    # Public IPv4 and IPv6 should not be flagged as restricted
    assert is_private_or_restricted_ip("8.8.8.8") is False
    assert is_private_or_restricted_ip("1.1.1.1") is False
    assert is_private_or_restricted_ip("2606:4700:4700::1111") is False


def test_apply_extraction_deduplicates_experiences_and_educations(client, test_user, db_session):
    """Calling apply-extraction multiple times with the same experience and education does not duplicate records."""
    from backend.app.schemas.profile_extraction import ExtractedEducation

    payload = ApplyExtractionRequest(
        profile=ExtractedProfileData(
            first_name="Jordan",
            last_name="Lee",
            headline="Lead Cloud Architect",
        ),
        skills=[
            ExtractedSkill(name="Kubernetes", years=5, months=0, source="resume"),
        ],
        experiences=[
            ExtractedExperience(
                company_name="Cloud Corp",
                job_title="DevOps Architect",
                start_date="2021-01-01",
                end_date="2024-01-01",
                source="resume",
            )
        ],
        educations=[
            ExtractedEducation(
                institution="National University",
                degree="B.S. Computer Science",
                field_of_study="Computer Science",
                start_year="2016",
                end_year="2020",
                source="resume",
            )
        ],
        complete_onboarding=False,
    )

    # First application
    resp1 = client.post("/api/v1/profile/apply-extraction", json=payload.model_dump())
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert len(data1["experiences"]) == 1
    assert len(data1["educations"]) == 1

    # Second application with exact same payload
    resp2 = client.post("/api/v1/profile/apply-extraction", json=payload.model_dump())
    assert resp2.status_code == 200
    data2 = resp2.json()

    # Experiences and educations must remain deduplicated
    assert len(data2["experiences"]) == 1
    assert len(data2["educations"]) == 1
    assert data2["experiences"][0]["company_name"] == "Cloud Corp"
    assert data2["educations"][0]["institution"] == "National University"


def test_extract_does_not_persist_resume_to_database(client, test_user, db_session):
    """Calling /profile/extract must be a pure read-only operation and NOT create a Resume record."""
    from backend.app.db.models.resume import Resume

    # Standard valid 1-page PDF byte sequence
    minimal_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF"
    )

    resp = client.post(
        "/api/v1/profile/extract",
        files={"resume": ("sample_test_resume.pdf", io.BytesIO(minimal_pdf), "application/pdf")},
    )
    assert resp.status_code == 200

    # Ensure no resume records were created in the database during extraction
    resumes = db_session.query(Resume).filter_by(user_id=test_user).all()
    assert len(resumes) == 0


def test_apply_extraction_does_not_overwrite_with_empty_values(client, test_user, db_session):
    """Applying extraction must not overwrite existing profile values with empty or blank strings."""
    # Pre-populate profile with established values
    profile = db_session.query(Profile).filter_by(id=test_user).first()
    profile.headline = "Principal Engineer"
    profile.city = "Bengaluru"
    profile.phone = "+91 9876543210"
    db_session.commit()

    payload = ApplyExtractionRequest(
        profile=ExtractedProfileData(
            first_name="Alex",
            last_name="Morgan",
            headline="",  # Empty string from extraction
            city=None,    # None
            phone="   ",  # Whitespace only
        ),
        skills=[],
        experiences=[],
        educations=[],
        complete_onboarding=False,
    )

    resp = client.post("/api/v1/profile/apply-extraction", json=payload.model_dump())
    assert resp.status_code == 200
    data = resp.json()

    # Pre-existing values must be preserved
    assert data["headline"] == "Principal Engineer"
    assert data["city"] == "Bengaluru"
    assert data["phone"] == "+91 9876543210"


