"""Unit & API tests for the free ATS Resume Checker."""

import io
from fastapi.testclient import TestClient
import pytest

from backend.app.main import app
from backend.app.services.ats_service import ATSResumeAnalyzer


@pytest.fixture
def client():
    return TestClient(app)


def test_ats_analyzer_corrupt_bytes():
    result = ATSResumeAnalyzer.analyze_pdf(b"not a valid pdf", filename="test.pdf")
    assert result["overall_score"] == 15
    assert "Unreadable" in result["grade"]
    assert len(result["findings"]) >= 1


def test_public_ats_endpoint_rejects_non_pdf(client):
    response = client.post(
        "/api/v1/resumes/ats-check",
        files={"file": ("resume.docx", b"Word document content", "application/msword")},
    )
    assert response.status_code == 400
    assert "Only PDF format" in response.json()["detail"]


def test_public_ats_endpoint_rejects_empty_pdf(client):
    response = client.post(
        "/api/v1/resumes/ats-check",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]


def test_public_ats_endpoint_rejects_oversized_pdf(client):
    oversized_data = b"%PDF-1.4 " + (b"0" * (5 * 1024 * 1024 + 10))
    response = client.post(
        "/api/v1/resumes/ats-check",
        files={"file": ("large.pdf", oversized_data, "application/pdf")},
    )
    assert response.status_code == 413
    assert "5MB" in response.json()["detail"]

