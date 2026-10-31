"""Regression tests for stale job selection prevention, canonical job identity, deduplication, and execution diagnostics."""

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base
from backend.app.db.models.job import Job
from backend.app.db.models.application import Application
from backend.app.services.application_service import ApplicationService
from backend.app.workers.linkedin_worker import (
    extract_canonical_job_identity,
    select_eligible_unapplied_jobs,
)
from linkedin_hunter.jobs.apply import execute_single_job_playwright_apply
from linkedin_hunter.config import HunterConfig


@pytest.fixture
def in_memory_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(engine)


def test_extract_canonical_job_identity_strips_tracking_params():
    """Verify URL parameters like refId and trackingId are stripped and canonical URL formed."""
    messy_url = "https://www.linkedin.com/jobs/view/4123456789?refId=abc123xyz&trackingId=987654&pageNum=0&position=1"
    job_id, canonical_url = extract_canonical_job_identity(messy_url)
    assert job_id == "4123456789"
    assert canonical_url == "https://www.linkedin.com/jobs/view/4123456789/"


def test_extract_canonical_job_identity_query_current_job_id():
    """Verify search URL with currentJobId query parameter is correctly parsed."""
    search_url = "https://www.linkedin.com/jobs/search/?currentJobId=4098765432&keywords=Python"
    job_id, canonical_url = extract_canonical_job_identity(search_url)
    assert job_id == "4098765432"
    assert canonical_url == "https://www.linkedin.com/jobs/view/4098765432/"


def test_select_eligible_unapplied_jobs_excludes_already_applied(in_memory_db):
    """Verify that jobs already applied to by the user are excluded from selection."""
    user_id = uuid.uuid4()
    other_user = uuid.uuid4()

    # Create 2 jobs
    job1 = Job(
        id=uuid.uuid4(),
        linkedin_job_id="job-101",
        title="Python Engineer",
        company="TechCorp",
        location="Remote",
        job_url="https://www.linkedin.com/jobs/view/job-101/",
        raw_data={"is_easy_apply": True},
        created_at=datetime.now(timezone.utc),
    )
    job2 = Job(
        id=uuid.uuid4(),
        linkedin_job_id="job-102",
        title="Backend Engineer",
        company="DataInc",
        location="Remote",
        job_url="https://www.linkedin.com/jobs/view/job-102/",
        raw_data={"is_easy_apply": True},
        created_at=datetime.now(timezone.utc),
    )
    in_memory_db.add_all([job1, job2])
    in_memory_db.commit()

    # User already applied to job1
    app1 = Application(
        id=uuid.uuid4(),
        user_id=user_id,
        job_id=job1.id,
        status="applied",
    )
    # Other user applied to job2 (should not exclude job2 for user_id)
    app2 = Application(
        id=uuid.uuid4(),
        user_id=other_user,
        job_id=job2.id,
        status="applied",
    )
    in_memory_db.add_all([app1, app2])
    in_memory_db.commit()

    selected = select_eligible_unapplied_jobs(
        in_memory_db,
        user_id=user_id,
        keywords_str="Engineer",
        location_str="Remote",
        limit_val=10,
    )
    selected_ids = [j.id for j in selected]

    assert job2.id in selected_ids
    assert job1.id not in selected_ids


def test_select_eligible_unapplied_jobs_excludes_stale_jobs_older_than_cutoff(in_memory_db):
    """Verify jobs older than the freshness threshold (30 days) are excluded."""
    user_id = uuid.uuid4()

    # Fresh job
    fresh_job = Job(
        id=uuid.uuid4(),
        linkedin_job_id="job-fresh",
        title="Software Engineer",
        company="Modern Tech",
        location="Remote",
        job_url="https://www.linkedin.com/jobs/view/job-fresh/",
        raw_data={"is_easy_apply": True},
        created_at=datetime.now(timezone.utc) - timedelta(days=5),
    )
    # Stale job older than 30 days
    stale_job = Job(
        id=uuid.uuid4(),
        linkedin_job_id="job-stale",
        title="Software Engineer",
        company="Old Tech",
        location="Remote",
        job_url="https://www.linkedin.com/jobs/view/job-stale/",
        raw_data={"is_easy_apply": True},
        created_at=datetime.now(timezone.utc) - timedelta(days=45),
    )
    # Expired job
    expired_job = Job(
        id=uuid.uuid4(),
        linkedin_job_id="job-expired",
        title="Software Engineer",
        company="Dead Tech",
        location="Remote",
        job_url="https://www.linkedin.com/jobs/view/job-expired/",
        raw_data={"is_easy_apply": True, "is_expired": True},
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
    )

    in_memory_db.add_all([fresh_job, stale_job, expired_job])
    in_memory_db.commit()

    selected = select_eligible_unapplied_jobs(
        in_memory_db,
        user_id=user_id,
        keywords_str="Software",
        location_str="Remote",
        limit_val=10,
        freshness_days=30,
    )
    selected_ids = [j.id for j in selected]

    assert fresh_job.id in selected_ids
    assert stale_job.id not in selected_ids
    assert expired_job.id not in selected_ids


def test_provider_search_returns_no_unrelated_jobs_when_criteria_match_nothing(in_memory_db):
    """An empty scope stays empty instead of falling back to unrelated records."""
    user_id = uuid.uuid4()
    unrelated = Job(
        id=uuid.uuid4(),
        linkedin_job_id="unrelated-qa",
        title="Retail Store Manager",
        company="Example Retail",
        location="Mumbai",
        job_url="https://www.linkedin.com/jobs/view/123456789/",
        raw_data={},
        created_at=datetime.now(timezone.utc),
    )
    in_memory_db.add(unrelated)
    in_memory_db.commit()

    selected = select_eligible_unapplied_jobs(
        in_memory_db,
        user_id=user_id,
        keywords_str="Senior Software Test Engineer",
        location_str="Noida",
        limit_val=10,
    )
    assert selected == []


def test_application_service_preserves_applied_status(in_memory_db):
    """Verify that record_application never overwrites or downgrades an existing 'applied' status."""
    user_id = uuid.uuid4()
    job_id = uuid.uuid4()

    # First record a successful live application
    first_app = ApplicationService.record_application(
        db=in_memory_db,
        user_id=user_id,
        job_id=job_id,
        status="applied",
        questions_answers={"Full Name": "Test User"},
    )
    assert first_app.status == "applied"

    # Now a dry run or skipped evaluation occurs for the same job
    second_app = ApplicationService.record_application(
        db=in_memory_db,
        user_id=user_id,
        job_id=job_id,
        status="dry_run_blocked",
        questions_answers={"Full Name": "Test User"},
    )
    # Status MUST remain 'applied'
    assert second_app.status == "applied"
    assert second_app.id == first_app.id


@pytest.mark.asyncio
async def test_execute_single_job_playwright_apply_expired_listing():
    """Verify that a closed/expired job listing returns failure_category='EXPIRED_LISTING'."""
    mock_page = AsyncMock()
    # Mock evaluate to return text snippet indicating closed listing
    mock_page.evaluate = AsyncMock(return_value="This job is no longer accepting applications.")
    mock_page.query_selector_all = AsyncMock(return_value=[])

    config = HunterConfig()

    result = await execute_single_job_playwright_apply(
        page=mock_page,
        config=config,
        job_url="https://www.linkedin.com/jobs/view/123456/",
        job_id="123456",
        job_title="Software Engineer",
        dry_run=True,
    )

    assert result["success"] is False
    assert result["failure_category"] == "EXPIRED_LISTING"
    assert result["retryable"] is False
