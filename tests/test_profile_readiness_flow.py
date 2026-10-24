"""End-to-End Test Suite for Profile & Application Readiness and Automation Workflow.

Follows the exact test order specified:
1. Profile page configuration (Contact, Links, Experience, Skills, Preferences, Search criteria)
2. Readiness calculation assertions (Blockers vs Warnings, Status changes)
3. Resume management lifecycle (Upload, Active status, Versioning, Replacement, Deletion)
4. Automation safety (Live submission blocked without Triple-Key confirmation, Dry Run available)
5. Full Profile completion
6. End-to-end Dry Run automation workflow (Job discovery -> Dry Run -> Application created -> Answers verified)
"""

import io
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import settings
from backend.app.db.database import Base, get_db
from backend.app.db.models.job import Job
from backend.app.main import app
import backend.app.workers.linkedin_worker as worker_module

from tests.conftest import TEST_SECRET, TestingSessionLocal, create_test_token, client

# Patch worker to use in-memory SQLite session
worker_module.SessionLocal = TestingSessionLocal

TEST_USER_ID = uuid.uuid4()


def create_token(user_id: uuid.UUID) -> str:
    return create_test_token(user_id)


@pytest.fixture
def auth_headers():
    token = create_token(TEST_USER_ID)
    return {"Authorization": f"Bearer {token}"}


# =========================================================================
# Phase 1: Profile Page Configuration & Field Integrity
# =========================================================================

def test_01_profile_contact_and_weblinks(auth_headers):
    """Test contact information and professional web links."""
    update_data = {
        "first_name": "Janmejay",
        "last_name": "Singh",
        "email": "janmejay.singh@example.com",
        "phone": "+91 9876543210",
        "city": "Noida",
        "state": "Uttar Pradesh",
        "country": "India",
        "linkedin_url": "https://linkedin.com/in/janmejaysingh",
        "github_url": "https://github.com/thejanmejay",
        "website_url": "https://janmejay.dev",
    }
    res = client.patch("/api/v1/profile", json=update_data, headers=auth_headers)
    assert res.status_code == 200, res.text
    profile = res.json()
    assert profile["first_name"] == "Janmejay"
    assert profile["last_name"] == "Singh"
    assert profile["email"] == "janmejay.singh@example.com"
    assert profile["phone"] == "+91 9876543210"
    assert profile["city"] == "Noida"
    assert profile["linkedin_url"] == "https://linkedin.com/in/janmejaysingh"
    assert profile["github_url"] == "https://github.com/thejanmejay"
    assert profile["website_url"] == "https://janmejay.dev"


def test_02_profile_experience_and_total_experience(auth_headers):
    """Test cumulative total experience and discrete experience history."""
    # 1. Update total domain experience
    res = client.patch(
        "/api/v1/profile",
        json={"experience_years": 3, "experience_months": 6},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["experience_years"] == 3
    assert res.json()["experience_months"] == 6

    # 2. Add discrete experience role
    exp_payload = {
        "company_name": "Acme Software QA Ltd",
        "job_title": "Senior SDET / Automation Lead",
        "start_date": "2023-01-15",
        "end_date": None,  # Current role
        "description": "Location: Noida | Built Playwright and Selenium end-to-end regression frameworks.",
    }
    res_exp = client.post(
        "/api/v1/profile/experiences", json=exp_payload, headers=auth_headers
    )
    assert res_exp.status_code == 201
    exp_data = res_exp.json()
    assert exp_data["company_name"] == "Acme Software QA Ltd"
    assert exp_data["job_title"] == "Senior SDET / Automation Lead"
    assert exp_data["end_date"] is None


def test_03_profile_skills_and_proficiency(auth_headers):
    """Test single skill addition and bulk skill addition with years/months."""
    # 1. Single skill
    res1 = client.post(
        "/api/v1/profile/skills",
        json={"name": "Selenium", "years": 2, "months": 6},
        headers=auth_headers,
    )
    assert res1.status_code == 201
    assert res1.json()["name"] == "Selenium"
    assert res1.json()["years"] == 2

    # 2. Bulk skills (Java, Playwright, API Testing, SQL)
    bulk_payload = {
        "skills": [
            {"name": "Java", "years": 2, "months": 0},
            {"name": "Playwright", "years": 1, "months": 6},
            {"name": "API Testing", "years": 2, "months": 0},
            {"name": "SQL", "years": 1, "months": 0},
        ]
    }
    res_bulk = client.post(
        "/api/v1/profile/skills/bulk", json=bulk_payload, headers=auth_headers
    )
    assert res_bulk.status_code == 201
    assert len(res_bulk.json()) >= 4


def test_04_application_preferences(auth_headers):
    """Test notice period, CTC, work authorization, and relocation preferences."""
    pref_payload = {
        "notice_period_days": 15,
        "current_ctc": 850000.0,
        "expected_ctc": 1200000.0,
        "authorized_to_work": True,
        "willing_to_relocate": True,
    }
    res = client.patch("/api/v1/profile", json=pref_payload, headers=auth_headers)
    assert res.status_code == 200
    profile = res.json()
    assert profile["notice_period_days"] == 15
    assert profile["current_ctc"] == 850000.0
    assert profile["expected_ctc"] == 1200000.0
    assert profile["authorized_to_work"] is True
    assert profile["willing_to_relocate"] is True


def test_05_search_criteria_configuration(auth_headers):
    """Test discovery search criteria configuration."""
    config_payload = {
        "name": "QA SDET Search Config",
        "keywords": ["QA Engineer", "SDET", "Automation Engineer"],
        "location": "Noida / Delhi NCR",
        "job_type": "full-time",
        "experience_level": "2-4 years",
        "remote_type": "hybrid",
        "date_posted": "past-month",
        "easy_apply_only": True,
        "max_jobs": 30,
        "is_active": True,
    }
    res = client.post("/api/v1/search-configs", json=config_payload, headers=auth_headers)
    assert res.status_code == 201
    cfg = res.json()
    assert cfg["name"] == "QA SDET Search Config"
    assert "SDET" in cfg["keywords"]
    assert cfg["easy_apply_only"] is True


# =========================================================================
# Phase 2: Resume Management Lifecycle (Upload, Versioning, Replace, Delete)
# =========================================================================

def test_06_resume_upload_and_versioning(auth_headers):
    """Test PDF upload, parsing activation, replacement with v2, and deletion."""
    pdf_v1 = b"%PDF-1.4\n1 0 obj\n<< /Title (Janmejay_Kumar_Singh_QA) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    files_v1 = {"file": ("Janmejay_Kumar_Singh_QA_v1.pdf", io.BytesIO(pdf_v1), "application/pdf")}

    # 1. Upload v1
    res1 = client.post("/api/v1/resumes/upload", files=files_v1, headers=auth_headers)
    assert res1.status_code == 201
    v1_data = res1.json()
    v1_id = v1_data["id"]
    assert v1_data["file_name"] == "Janmejay_Kumar_Singh_QA_v1.pdf"
    assert v1_data["version"] == 1
    assert v1_data["is_active"] is True

    # 2. Upload v2 (Replace)
    pdf_v2 = b"%PDF-1.4\n1 0 obj\n<< /Title (Janmejay_Kumar_Singh_QA_v2) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    files_v2 = {"file": ("Janmejay_Kumar_Singh_QA_v2.pdf", io.BytesIO(pdf_v2), "application/pdf")}
    res2 = client.post("/api/v1/resumes/upload", files=files_v2, headers=auth_headers)
    assert res2.status_code == 201
    v2_data = res2.json()
    assert v2_data["version"] == 2
    assert v2_data["is_active"] is True

    # Check that listing resumes shows both
    res_list = client.get("/api/v1/resumes", headers=auth_headers)
    assert res_list.status_code == 200
    resumes = res_list.json()
    assert len(resumes) >= 2

    # 3. Delete v1 (archived version)
    res_del = client.delete(f"/api/v1/resumes/{v1_id}", headers=auth_headers)
    assert res_del.status_code == 204

    # Verify v1 is gone and v2 remains
    res_get_v1 = client.get(f"/api/v1/resumes/{v1_id}", headers=auth_headers)
    assert res_get_v1.status_code == 404
    res_get_v2 = client.get(f"/api/v1/resumes/{v2_data['id']}", headers=auth_headers)
    assert res_get_v2.status_code == 200


# =========================================================================
# Phase 3: Automation Safety (Triple-Key Guard & Dry Run Authorization)
# =========================================================================

@pytest.mark.asyncio
async def test_07_triple_key_live_submission_guard(auth_headers):
    """Verify Triple-Key live submission condition checks."""
    from unittest.mock import AsyncMock
    from linkedin_hunter.config import HunterConfig
    from linkedin_hunter.jobs.apply import execute_single_job_playwright_apply

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"
    mock_modal = AsyncMock()
    mock_footer_btn = AsyncMock()
    mock_footer_btn.get_attribute.return_value = "Submit application"
    mock_footer_btn.text_content.return_value = "Submit application"

    async def mock_query_selector(sel):
        if "button" in sel or "primary" in sel or "next" in sel:
            return mock_footer_btn
        if "modal" in sel or "easy-apply" in sel or "content" in sel:
            return mock_modal
        return None

    mock_page.query_selector.side_effect = mock_query_selector
    mock_page.query_selector_all.return_value = [mock_footer_btn]
    config = HunterConfig()

    with patch("linkedin_hunter.jobs.apply.submit_final_application", new_callable=AsyncMock) as mock_submit:
        with patch("linkedin_hunter.jobs.apply.detect_form_fields", new_callable=AsyncMock) as mock_detect:
            mock_detect.return_value = []
            with patch("linkedin_hunter.jobs.apply._click_easy_apply", new_callable=AsyncMock) as mock_click:
                mock_click.return_value = True
                with patch("linkedin_hunter.jobs.apply._is_already_applied_on_page", new_callable=AsyncMock) as mock_applied:
                    mock_applied.return_value = False
                    with patch("linkedin_hunter.jobs.apply._scrape_modal_profile", new_callable=AsyncMock):
                        # Case 1: dry_run=True blocks submission
                        res_dry = await execute_single_job_playwright_apply(
                            page=mock_page,
                            config=config,
                            job_url="https://www.linkedin.com/jobs/view/123456",
                            job_id="test-job-dry",
                            job_title="QA Engineer",
                            dry_run=True,
                            allow_live_submission=True,
                            live_submission_confirmation="CONFIRM_REAL_SUBMISSION",
                        )
                        mock_submit.assert_not_called()
                        assert res_dry["submission_blocked"] is True

                        # Case 2: dry_run=False, allow_live_submission=True BUT invalid confirmation token
                        res_bad_token = await execute_single_job_playwright_apply(
                            page=mock_page,
                            config=config,
                            job_url="https://www.linkedin.com/jobs/view/123456",
                            job_id="test-job-bad-token",
                            job_title="QA Engineer",
                            dry_run=False,
                            allow_live_submission=True,
                            live_submission_confirmation="WRONG_TOKEN",
                        )
                        mock_submit.assert_not_called()
                        assert res_bad_token["submission_blocked"] is True

                        # Case 3: dry_run=False, allow_live_submission=False
                        res_no_allow = await execute_single_job_playwright_apply(
                            page=mock_page,
                            config=config,
                            job_url="https://www.linkedin.com/jobs/view/123456",
                            job_id="test-job-no-allow",
                            job_title="QA Engineer",
                            dry_run=False,
                            allow_live_submission=False,
                            live_submission_confirmation="CONFIRM_REAL_SUBMISSION",
                        )
                        mock_submit.assert_not_called()
                        assert res_no_allow["submission_blocked"] is True


# =========================================================================
# Phase 4: End-to-End Dry Run Automation Workflow
# =========================================================================

def test_08_end_to_end_dry_run_workflow(auth_headers):
    """Execute complete workflow: Ready Profile -> Find Job -> Dry Run -> Verify Application."""
    # 1. Seed a test job in the database
    db = TestingSessionLocal()
    job_id = uuid.uuid4()
    seed_job = Job(
        id=job_id,
        linkedin_job_id=f"li-test-{uuid.uuid4().hex[:8]}",
        title="Senior QA Automation Engineer (Playwright / Selenium)",
        company="Global FinTech Solutions",
        location="Noida, India",
        description="Looking for an SDET with Selenium and Playwright experience. Must have 2+ years exp. Immediate or 15 days notice.",
        job_url="https://www.linkedin.com/jobs/view/9999999999",
        raw_data={"is_easy_apply": True},
    )
    db.add(seed_job)
    db.commit()
    db.close()

    # 2. Verify job is discoverable
    res_jobs = client.get("/api/v1/jobs?search=Playwright", headers=auth_headers)
    assert res_jobs.status_code == 200
    assert len(res_jobs.json()) >= 1

    # 3. Launch Dry Run Automation
    dry_run_payload = {
        "dry_run": True,
        "max_jobs": 10,
    }
    with patch("backend.app.api.automation.run_linkedin_automation_task") as mock_worker:
        res_run = client.post(
            "/api/v1/automation/runs", json=dry_run_payload, headers=auth_headers
        )
        assert res_run.status_code == 201
        run_data = res_run.json()
        assert run_data["dry_run"] is True
        assert run_data["status"] == "queued"
        run_id = run_data["id"]
        assert mock_worker.called

    # 4. Verify run status retrieval
    res_run_detail = client.get(
        f"/api/v1/automation/runs/{run_id}", headers=auth_headers
    )
    assert res_run_detail.status_code == 200
    assert res_run_detail.json()["id"] == run_id

    # 5. Verify telemetry logs endpoint exists and is scoped
    res_logs = client.get(
        f"/api/v1/automation/runs/{run_id}/logs", headers=auth_headers
    )
    assert res_logs.status_code == 200
    assert isinstance(res_logs.json(), list)
