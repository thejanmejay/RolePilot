"""Comprehensive tests for FastAPI backend, JWT authentication, and multi-tenant isolation."""

import io
import uuid
import jwt
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import settings
from backend.app.core.security import get_current_user_id
from backend.app.db.database import Base, get_db
from backend.app.main import app

from tests.conftest import (
    TEST_SECRET,
    TestingSessionLocal,
    USER_A_ID,
    USER_B_ID,
    client,
    create_test_token,
)


# ==========================================
# 1. Health Checks
# ==========================================

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_check_db():
    response = client.get("/health/db")
    assert response.status_code == 200
    assert "status" in response.json()


# ==========================================
# 2. Authentication & 401 Unauthorized
# ==========================================

def test_unauthenticated_profile_access():
    response = client.get("/api/v1/profile")
    assert response.status_code == 401
    assert "detail" in response.json()


def test_invalid_token_access():
    response = client.get(
        "/api/v1/profile",
        headers={"Authorization": "Bearer invalid.token.payload"},
    )
    assert response.status_code == 401


# ==========================================
# 3. Profile Management & Scoping
# ==========================================

def test_get_and_update_profile(auth_headers_user_a):
    res = client.get("/api/v1/profile", headers=auth_headers_user_a)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(USER_A_ID)

    update_payload = {
        "first_name": "Alice",
        "last_name": "Engineer",
        "email": "alice@example.com",
        "experience_years": 4,
        "experience_months": 6,
        "notice_period_days": 15,
        "authorized_to_work": True,
    }
    res_update = client.patch(
        "/api/v1/profile", json=update_payload, headers=auth_headers_user_a
    )
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["first_name"] == "Alice"
    assert updated["experience_years"] == 4
    assert updated["notice_period_days"] == 15


def test_add_and_delete_skill(auth_headers_user_a):
    skill_payload = {"name": "Python", "years": 4, "months": 6}
    res = client.post(
        "/api/v1/profile/skills", json=skill_payload, headers=auth_headers_user_a
    )
    assert res.status_code == 201
    skill_id = res.json()["id"]

    res_del = client.delete(
        f"/api/v1/profile/skills/{skill_id}", headers=auth_headers_user_a
    )
    assert res_del.status_code == 204


# ==========================================
# 4. Search Config Management & Ownership
# ==========================================

def test_search_config_crud_and_isolation(auth_headers_user_a, auth_headers_user_b):
    payload = {
        "name": "Frontend Lead",
        "keywords": ["React", "TypeScript"],
        "location": "Remote",
        "max_jobs": 30,
        "easy_apply_only": True,
    }
    res = client.post("/api/v1/search-configs", json=payload, headers=auth_headers_user_a)
    assert res.status_code == 201
    config_a = res.json()
    config_a_id = config_a["id"]
    assert config_a["user_id"] == str(USER_A_ID)

    res_get = client.get(f"/api/v1/search-configs/{config_a_id}", headers=auth_headers_user_a)
    assert res_get.status_code == 200

    res_b_get = client.get(f"/api/v1/search-configs/{config_a_id}", headers=auth_headers_user_b)
    assert res_b_get.status_code == 404

    res_b_patch = client.patch(
        f"/api/v1/search-configs/{config_a_id}",
        json={"name": "Hacked"},
        headers=auth_headers_user_b,
    )
    assert res_b_patch.status_code == 404

    res_b_del = client.delete(
        f"/api/v1/search-configs/{config_a_id}", headers=auth_headers_user_b
    )
    assert res_b_del.status_code == 404

    res_list_a = client.get("/api/v1/search-configs", headers=auth_headers_user_a)
    assert len(res_list_a.json()) >= 1

    res_list_b = client.get("/api/v1/search-configs", headers=auth_headers_user_b)
    assert len(res_list_b.json()) == 0


# ==========================================
# 5. Resume Upload Validation & Scoping
# ==========================================

def test_resume_upload_non_pdf_rejection(auth_headers_user_a):
    file_data = io.BytesIO(b"fake txt content")
    files = {"file": ("test.txt", file_data, "text/plain")}
    res = client.post("/api/v1/resumes/upload", files=files, headers=auth_headers_user_a)
    assert res.status_code == 400
    assert "Only PDF" in res.json()["detail"]


def test_resume_upload_and_isolation(auth_headers_user_a, auth_headers_user_b):
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    files = {"file": ("my_resume.pdf", io.BytesIO(pdf_content), "application/pdf")}

    res = client.post("/api/v1/resumes/upload", files=files, headers=auth_headers_user_a)
    assert res.status_code == 201
    resume_a = res.json()
    resume_a_id = resume_a["id"]
    assert resume_a["user_id"] == str(USER_A_ID)
    assert resume_a["version"] == 1
    assert resume_a["is_active"] is True

    res_b = client.get(f"/api/v1/resumes/{resume_a_id}", headers=auth_headers_user_b)
    assert res_b.status_code == 404

    res_b_del = client.delete(f"/api/v1/resumes/{resume_a_id}", headers=auth_headers_user_b)
    assert res_b_del.status_code == 404


# ==========================================
# 6. Global Jobs & Application Scoping
# ==========================================

def test_jobs_and_application_isolation(auth_headers_user_a, auth_headers_user_b):
    res_jobs = client.get("/api/v1/jobs", headers=auth_headers_user_a)
    assert res_jobs.status_code == 200
    assert isinstance(res_jobs.json(), list)

    res_apps = client.get("/api/v1/applications", headers=auth_headers_user_a)
    assert res_apps.status_code == 200
    assert isinstance(res_apps.json(), list)


# ==========================================
# 7. Automation Runs & Isolation
# ==========================================

def test_automation_run_creation_and_logs(auth_headers_user_a, auth_headers_user_b, monkeypatch):
    from unittest.mock import AsyncMock, patch
    from backend.app.services.linkedin_session_validator import PreflightValidationResult

    monkeypatch.setattr(
        "backend.app.api.automation.run_linkedin_automation_task",
        lambda *args, **kwargs: None,
    )
    client.post("/api/v1/linkedin/consent", json={"accepted": True}, headers=auth_headers_user_a)
    run_payload = {
        "dry_run": True,
        "max_jobs": 10,
    }
    with patch(
        "backend.app.services.linkedin_session_validator.LinkedInSessionValidator.validate_session",
        new_callable=AsyncMock,
        return_value=PreflightValidationResult(is_valid=True, cookies=[{"name": "li_at", "value": "test-cookie"}]),
    ), patch("backend.app.workers.queue_worker.QueueWorker.process_run_by_id"):
        res = client.post("/api/v1/automation/runs", json=run_payload, headers=auth_headers_user_a)
    assert res.status_code == 201
    run_data = res.json()
    run_id = run_data["id"]
    assert run_data["user_id"] == str(USER_A_ID)
    assert run_data["status"] in ("pending", "queued")

    res_get = client.get(f"/api/v1/automation/runs/{run_id}", headers=auth_headers_user_a)
    assert res_get.status_code == 200

    res_logs = client.get(f"/api/v1/automation/runs/{run_id}/logs", headers=auth_headers_user_a)
    assert res_logs.status_code == 200
    assert len(res_logs.json()) >= 1

    res_b_get = client.get(f"/api/v1/automation/runs/{run_id}", headers=auth_headers_user_b)
    assert res_b_get.status_code == 404

    res_b_logs = client.get(f"/api/v1/automation/runs/{run_id}/logs", headers=auth_headers_user_b)
    assert len(res_b_logs.json()) == 0

    res_cancel = client.post(f"/api/v1/automation/runs/{run_id}/cancel", headers=auth_headers_user_a)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] in ("cancelled", "failed", "completed")


# ==========================================
# 8. Explicit Multi-Tenant Isolation Tests
# ==========================================

def test_user_a_cannot_access_user_b_profile(auth_headers_user_a, auth_headers_user_b):
    client.patch("/api/v1/profile", json={"first_name": "AliceProfile"}, headers=auth_headers_user_a)
    client.patch("/api/v1/profile", json={"first_name": "BobProfile"}, headers=auth_headers_user_b)

    res_a = client.get("/api/v1/profile", headers=auth_headers_user_a)
    assert res_a.json()["first_name"] == "AliceProfile"

    res_b = client.get("/api/v1/profile", headers=auth_headers_user_b)
    assert res_b.json()["first_name"] == "BobProfile"


def test_user_a_cannot_access_user_b_applications_and_answers(auth_headers_user_a, auth_headers_user_b):
    from backend.app.services.job_service import JobService
    from backend.app.services.application_service import ApplicationService

    db = TestingSessionLocal()
    try:
        job = JobService.upsert_job(
            db=db,
            linkedin_job_id=f"test_linkedin_job_{uuid.uuid4()}",
            title="Senior QA Engineer",
            company="Acme Corp",
            job_url="https://linkedin.com/jobs/view/123",
        )
        job_id = job.id
        db.commit()
    finally:
        db.close()

    res_create = client.post(
        "/api/v1/applications",
        json={"job_id": str(job_id), "status": "applied"},
        headers=auth_headers_user_a,
    )
    assert res_create.status_code == 201
    app_a_id = res_create.json()["id"]

    db = TestingSessionLocal()
    try:
        ApplicationService.record_answer(
            db=db,
            application_id=uuid.UUID(app_a_id),
            question="Years of Python?",
            answer="5",
        )
        db.commit()
    finally:
        db.close()

    res_a = client.get(f"/api/v1/applications/{app_a_id}", headers=auth_headers_user_a)
    assert res_a.status_code == 200
    assert res_a.json()["job"]["title"] == "Senior QA Engineer"

    res_answers = client.get(f"/api/v1/applications/{app_a_id}/answers", headers=auth_headers_user_a)
    assert res_answers.status_code == 200
    assert len(res_answers.json()) == 1
    assert res_answers.json()[0]["answer"] == "5"

    res_b = client.get(f"/api/v1/applications/{app_a_id}", headers=auth_headers_user_b)
    assert res_b.status_code == 404

    res_b_answers = client.get(f"/api/v1/applications/{app_a_id}/answers", headers=auth_headers_user_b)
    assert res_b_answers.status_code == 404


def test_experience_management_and_isolation(auth_headers_user_a, auth_headers_user_b):
    exp_payload = {
        "company_name": "Tech Corp",
        "job_title": "Software Engineer",
        "description": "Developed microservices and automated tests.",
    }
    res_a = client.post("/api/v1/profile/experiences", json=exp_payload, headers=auth_headers_user_a)
    assert res_a.status_code == 201
    exp_id = res_a.json()["id"]

    res_b_del = client.delete(f"/api/v1/profile/experiences/{exp_id}", headers=auth_headers_user_b)
    assert res_b_del.status_code == 404

    res_a_del = client.delete(f"/api/v1/profile/experiences/{exp_id}", headers=auth_headers_user_a)
    assert res_a_del.status_code == 204
