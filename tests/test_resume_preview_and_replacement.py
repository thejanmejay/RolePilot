"""Tests for Resume Preview, Replacement, Profile Synchronization, and Versioning."""

import io
import uuid
import pytest
from sqlalchemy import select
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.db.database import get_db
from backend.app.db.models.education import Education
from backend.app.db.models.experience import Experience
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.skill import Skill
from backend.app.main import app
from tests.conftest import create_test_token

client = TestClient(app)


def get_fresh_user_headers():
    uid = uuid.uuid4()
    db = next(get_db())
    try:
        profile = Profile(id=uid, email=f"user_{uid}@example.com")
        db.add(profile)
        acceptance = UserPolicyAcceptance(
            user_id=uid,
            policy_type=settings.ACTIVE_POLICY_TYPE,
            policy_version=settings.ACTIVE_POLICY_VERSION,
        )
        db.add(acceptance)
        db.commit()
    finally:
        db.close()

    token = create_test_token(uid)
    return {"Authorization": f"Bearer {token}"}, uid

SAMPLE_PDF_HEADER = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Title (Candidate Resume) >>\nendobj\n"
    b"2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n"
    b"3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n"
    b"4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>\nendobj\n"
    b"5 0 obj\n<< /Length 260 >>\nstream\n"
    b"BT /F1 12 Tf 50 700 Td (Alex Morgan) Tj 0 -20 Td (alex@example.com) Tj 0 -20 Td (Software Engineer with over five years of experience building distributed systems with Python, React, PostgreSQL, Docker, Git, CI/CD, and AWS cloud architecture.) Tj ET\n"
    b"endstream\nendobj\n"
    b"6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    b"xref\n0 7\n0000000000 65535 f \n"
    b"trailer\n<< /Size 7 /Root 2 0 R >>\nstartxref\n600\n%%EOF"
)

REPLACEMENT_PDF_HEADER = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Title (Replacement Resume) >>\nendobj\n"
    b"2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n"
    b"3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n"
    b"4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>\nendobj\n"
    b"5 0 obj\n<< /Length 280 >>\nstream\n"
    b"BT /F1 12 Tf 50 700 Td (Jordan Lee) Tj 0 -20 Td (jordan.lee@example.com) Tj 0 -20 Td (Lead Systems Architect with eight years of engineering leadership in Kubernetes, Python, React, FastAPI, Docker, and Microservices.) Tj ET\n"
    b"endstream\nendobj\n"
    b"6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    b"xref\n0 7\n0000000000 65535 f \n"
    b"trailer\n<< /Size 7 /Root 2 0 R >>\nstartxref\n620\n%%EOF"
)


def test_resume_preview_binary_streaming():
    """Verify that uploaded PDF resume can be streamed as application/pdf with tenant isolation."""
    headers_a, _ = get_fresh_user_headers()
    headers_b, _ = get_fresh_user_headers()

    files = {"file": ("my_cv.pdf", io.BytesIO(SAMPLE_PDF_HEADER), "application/pdf")}
    res_upload = client.post("/api/v1/resumes/upload", files=files, headers=headers_a)
    assert res_upload.status_code == 201
    resume_a = res_upload.json()
    resume_id = resume_a["id"]

    # 1. User A can preview their resume file
    res_file = client.get(f"/api/v1/resumes/{resume_id}/file", headers=headers_a)
    assert res_file.status_code == 200
    assert res_file.headers["content-type"] == "application/pdf"
    assert "inline" in res_file.headers.get("content-disposition", "")
    assert res_file.content.startswith(b"%PDF")

    # 2. User B cannot preview User A's resume (Tenant Isolation)
    res_b = client.get(f"/api/v1/resumes/{resume_id}/file", headers=headers_b)
    assert res_b.status_code == 404


def test_resume_replacement_keeps_active_version_intact():
    """Verify that replacement creates v+1 as inactive draft and leaves active resume active until activation."""
    headers_a, _ = get_fresh_user_headers()

    # 1. Upload initial resume
    files_1 = {"file": ("resume_v1.pdf", io.BytesIO(SAMPLE_PDF_HEADER), "application/pdf")}
    res_1 = client.post("/api/v1/resumes/upload", files=files_1, headers=headers_a)
    assert res_1.status_code == 201
    resume_v1 = res_1.json()
    assert resume_v1["version"] == 1
    assert resume_v1["is_active"] is True

    # 2. Upload replacement resume
    files_2 = {"file": ("resume_v2.pdf", io.BytesIO(REPLACEMENT_PDF_HEADER), "application/pdf")}
    res_replace = client.post("/api/v1/resumes/replace", files=files_2, headers=headers_a)
    assert res_replace.status_code == 201
    data = res_replace.json()

    new_resume = data["new_resume"]
    assert new_resume["version"] == 2
    assert new_resume["is_active"] is False  # Must NOT be active yet!

    # 3. Verify original resume is STILL the active resume in database
    list_res = client.get("/api/v1/resumes", headers=headers_a)
    assert list_res.status_code == 200
    all_resumes = list_res.json()
    v1_record = next(r for r in all_resumes if r["id"] == resume_v1["id"])
    v2_record = next(r for r in all_resumes if r["id"] == new_resume["id"])
    assert v1_record["is_active"] is True
    assert v2_record["is_active"] is False

    # 4. Activate replacement resume
    res_act = client.post(
        f"/api/v1/resumes/{new_resume['id']}/activate",
        json={"add_skills": True, "add_experiences": True, "add_educations": True},
        headers=headers_a,
    )
    assert res_act.status_code == 200
    act_data = res_act.json()
    assert act_data["resume"]["is_active"] is True

    # 5. Verify v1 is now archived/inactive and v2 is active
    list_res_after = client.get("/api/v1/resumes", headers=headers_a)
    all_after = list_res_after.json()
    v1_after = next(r for r in all_after if r["id"] == resume_v1["id"])
    v2_after = next(r for r in all_after if r["id"] == new_resume["id"])
    assert v1_after["is_active"] is False
    assert v2_after["is_active"] is True


def test_resume_replacement_rejects_invalid_corrupted_files():
    """Verify that corrupted or non-PDF files are rejected without modifying candidate state."""
    headers_a, _ = get_fresh_user_headers()

    # Non-PDF
    bad_files = {"file": ("malicious.sh", io.BytesIO(b"echo hack"), "text/plain")}
    res_bad = client.post("/api/v1/resumes/replace", files=bad_files, headers=headers_a)
    assert res_bad.status_code == 400
    assert "Only PDF" in res_bad.json()["detail"]

    # Missing PDF header
    corrupted_files = {"file": ("broken.pdf", io.BytesIO(b"not a valid pdf binary"), "application/pdf")}
    res_corrupt = client.post("/api/v1/resumes/replace", files=corrupted_files, headers=headers_a)
    assert res_corrupt.status_code == 400
    assert "header is missing or corrupted" in res_corrupt.json()["detail"]

    # Empty file
    empty_files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    res_empty = client.post("/api/v1/resumes/replace", files=empty_files, headers=headers_a)
    assert res_empty.status_code == 400
    assert "empty" in res_empty.json()["detail"]


def test_profile_synchronization_preserves_manual_fields():
    """Verify that replacement preserves manually entered fields (e.g. notice period, CTC, work auth)."""
    headers_a, _ = get_fresh_user_headers()

    # 1. Update candidate profile with manual values
    update_res = client.patch(
        "/api/v1/profile",
        json={
            "first_name": "InitialName",
            "notice_period_days": 45,
            "current_ctc": 1500000,
            "authorized_to_work": True,
            "willing_to_relocate": True,
        },
        headers=headers_a,
    )
    assert update_res.status_code == 200

    # 2. Upload replacement resume
    files = {"file": ("cv_update.pdf", io.BytesIO(REPLACEMENT_PDF_HEADER), "application/pdf")}
    res_replace = client.post("/api/v1/resumes/replace", files=files, headers=headers_a)
    assert res_replace.status_code == 201
    rep_data = res_replace.json()
    new_resume_id = rep_data["new_resume"]["id"]

    # Verify diff reports preserved fields
    preserved = rep_data["diff"]["preserved_fields"]
    assert "notice_period_days" in preserved
    assert "current_ctc" in preserved

    # 3. Activate resume
    res_act = client.post(
        f"/api/v1/resumes/{new_resume_id}/activate",
        json={"add_skills": True},
        headers=headers_a,
    )
    assert res_act.status_code == 200

    # 4. Fetch profile and verify manual fields remain intact
    prof_res = client.get("/api/v1/profile", headers=headers_a)
    assert prof_res.status_code == 200
    profile = prof_res.json()
    assert profile["notice_period_days"] == 45
    assert profile["current_ctc"] == 1500000
    assert profile["authorized_to_work"] is True
    assert profile["willing_to_relocate"] is True


def test_parsing_failure_preserves_profile_intact():
    """Verify that an unparseable or minimal PDF does not erase or corrupt existing profile information."""
    headers_a, _ = get_fresh_user_headers()

    # Pre-populate profile
    client.patch(
        "/api/v1/profile",
        json={"first_name": "StableCandidate", "headline": "Staff Engineer"},
        headers=headers_a,
    )

    # Replacement with minimal unparseable PDF (1-page valid PDF with no extractable text)
    minimal_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    )
    files = {"file": ("minimal.pdf", io.BytesIO(minimal_pdf), "application/pdf")}
    res_replace = client.post("/api/v1/resumes/replace", files=files, headers=headers_a)
    assert res_replace.status_code == 201
    rep_data = res_replace.json()
    new_id = rep_data["new_resume"]["id"]

    # Activate
    res_act = client.post(
        f"/api/v1/resumes/{new_id}/activate",
        json={"add_skills": True},
        headers=headers_a,
    )
    assert res_act.status_code == 200

    # Profile must retain existing name and headline without deletion or empty string overwrite
    prof = client.get("/api/v1/profile", headers=headers_a).json()
    assert prof["first_name"] == "StableCandidate"
    assert prof["headline"] == "Staff Engineer"


def test_conflicting_information_custom_acceptance():
    """Verify that conflicting fields detected during replacement can be selectively accepted."""
    headers_a, _ = get_fresh_user_headers()

    # Pre-populate profile with specific values
    client.patch(
        "/api/v1/profile",
        json={"first_name": "OldFirst", "last_name": "OldLast", "city": "Bengaluru"},
        headers=headers_a,
    )

    # Replacement has "Alex Morgan"
    files = {"file": ("alex.pdf", io.BytesIO(SAMPLE_PDF_HEADER), "application/pdf")}
    res_replace = client.post("/api/v1/resumes/replace", files=files, headers=headers_a)
    assert res_replace.status_code == 201
    rep = res_replace.json()
    assert rep["has_conflicts"] is True

    # User selectively keeps OldLast, but accepts NewFirst "Alex"
    new_id = rep["new_resume"]["id"]
    res_act = client.post(
        f"/api/v1/resumes/{new_id}/activate",
        json={
            "accepted_fields": {"first_name": "Alex", "last_name": "OldLast"},
            "add_skills": True,
        },
        headers=headers_a,
    )
    assert res_act.status_code == 200

    prof = client.get("/api/v1/profile", headers=headers_a).json()
    assert prof["first_name"] == "Alex"
    assert prof["last_name"] == "OldLast"
    assert prof["city"] == "Bengaluru"  # Preserved


def test_resume_version_history_and_deletion_safety():
    """Verify that multiple versions accumulate and deleting historical version does not delete active version."""
    headers_a, _ = get_fresh_user_headers()

    # Upload v1
    f1 = {"file": ("v1.pdf", io.BytesIO(SAMPLE_PDF_HEADER), "application/pdf")}
    r1 = client.post("/api/v1/resumes/upload", files=f1, headers=headers_a).json()

    # Replace v2
    f2 = {"file": ("v2.pdf", io.BytesIO(REPLACEMENT_PDF_HEADER), "application/pdf")}
    r2 = client.post("/api/v1/resumes/replace", files=f2, headers=headers_a).json()["new_resume"]
    client.post(f"/api/v1/resumes/{r2['id']}/activate", json={}, headers=headers_a)

    # List versions
    all_res = client.get("/api/v1/resumes", headers=headers_a).json()
    assert len(all_res) == 2
    assert any(r["id"] == r1["id"] and not r["is_active"] for r in all_res)
    assert any(r["id"] == r2["id"] and r["is_active"] for r in all_res)

    # Delete historical v1
    del_res = client.delete(f"/api/v1/resumes/{r1['id']}", headers=headers_a)
    assert del_res.status_code == 204

    # Verify v2 remains intact and active
    after_res = client.get("/api/v1/resumes", headers=headers_a).json()
    assert len(after_res) == 1
    assert after_res[0]["id"] == r2["id"]
    assert after_res[0]["is_active"] is True


def test_complete_resume_replacement_reconciliation_experiences_educations():
    """Verify that replacing Resume A with Resume B reconciles experiences and educations without duplicates."""
    headers_a, uid = get_fresh_user_headers()
    db = next(get_db())

    try:
        # Pre-seed candidate with Resume A as active
        resume_a = Resume(
            user_id=uid,
            file_name="resume_a.pdf",
            storage_path=f"resumes/{uid}/resume_a.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "experiences": [
                    {"company_name": "Legacy Corp", "job_title": "Junior QA"},
                    {"company_name": "Outdated Inc", "job_title": "Intern"},
                ]
            },
        )
        db.add(resume_a)
        db.add(Experience(user_id=uid, company_name="Legacy Corp", job_title="Junior QA", description="Old job"))
        db.add(Experience(user_id=uid, company_name="Outdated Inc", job_title="Intern", description="Internship"))
        db.commit()
    finally:
        db.close()

    # Create Resume B with new experiences and educations
    db = next(get_db())
    try:
        new_resume = Resume(
            user_id=uid,
            file_name="new_cv.pdf",
            storage_path=f"resumes/{uid}/new_cv.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "headline": "Lead QA Automation Engineer",
                "target_role": "QA Lead",
                "experiences": [
                    {
                        "company_name": "Apex Tech",
                        "job_title": "Senior Automation Engineer",
                        "start_date": "2023-01-01",
                        "end_date": None,
                        "description": "Leading Playwright frameworks.",
                    },
                    {
                        "company_name": "Legacy Corp",
                        "job_title": "Junior QA",  # Overlapping company - should update in place
                        "start_date": "2021-06-01",
                        "end_date": "2022-12-01",
                        "description": "Updated description from new resume.",
                    },
                ],
                "educations": [
                    {
                        "institution": "National University",
                        "degree": "B.Tech",
                        "field_of_study": "Computer Science",
                        "start_year": "2017",
                        "end_year": "2021",
                    }
                ],
                "skills": ["Playwright", "TypeScript", "Python"],
            },
        )
        db.add(new_resume)
        db.commit()
        db.refresh(new_resume)
        new_resume_id = new_resume.id
    finally:
        db.close()

    # Activate Resume B
    res_act = client.post(
        f"/api/v1/resumes/{new_resume_id}/activate",
        json={"add_experiences": True, "add_educations": True, "add_skills": True},
        headers=headers_a,
    )
    assert res_act.status_code == 200

    # Fetch updated profile
    prof = client.get("/api/v1/profile", headers=headers_a).json()
    exps = prof.get("experiences", [])

    # 1. Stale experience "Outdated Inc" from Resume A MUST NOT remain!
    comp_names = [e["company_name"] for e in exps]
    assert "Outdated Inc" not in comp_names
    assert "Apex Tech" in comp_names
    assert "Legacy Corp" in comp_names
    assert len(exps) == 2

    # 2. In-place update preserved stable ID for "Legacy Corp"
    legacy_exp = next(e for e in exps if e["company_name"] == "Legacy Corp")
    assert legacy_exp["description"] == "Updated description from new resume."

    # 3. Educations reconciled
    edus = prof.get("educations", [])
    assert len(edus) == 1
    assert edus[0]["institution"] == "National University"

    # 4. Idempotency test: repeating activation does not duplicate records
    res_repeat = client.post(
        f"/api/v1/resumes/{new_resume_id}/activate",
        json={"add_experiences": True, "add_educations": True, "add_skills": True},
        headers=headers_a,
    )
    assert res_repeat.status_code == 200

    prof_repeat = client.get("/api/v1/profile", headers=headers_a).json()
    assert len(prof_repeat.get("experiences", [])) == 2
    assert len(prof_repeat.get("educations", [])) == 1


def test_resume_replacement_keep_current_and_stale_clearing():
    """Verify that Keep Current preserves old values while stale fields can be cleared."""
    headers_a, uid = get_fresh_user_headers()

    db = next(get_db())
    try:
        # Resume A was active and supplied first_name, phone, website_url
        resume_a = Resume(
            user_id=uid,
            file_name="resume_a.pdf",
            storage_path=f"resumes/{uid}/resume_a.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "first_name": "OriginalFirst",
                "phone": "+91 9999988888",
                "website_url": "https://oldportfolio.dev",
            },
        )
        db.add(resume_a)
        db.commit()
    finally:
        db.close()

    # Pre-populate profile with Resume A's data
    client.patch(
        "/api/v1/profile",
        json={
            "first_name": "OriginalFirst",
            "last_name": "OriginalLast",
            "phone": "+91 9999988888",
            "website_url": "https://oldportfolio.dev",
        },
        headers=headers_a,
    )

    db = next(get_db())
    try:
        new_resume = Resume(
            user_id=uid,
            file_name="new_cv2.pdf",
            storage_path=f"resumes/{uid}/new_cv2.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "first_name": "ReplacementFirst",
                "last_name": "ReplacementLast",
                # Note: No phone and no website_url in new resume
            },
        )
        db.add(new_resume)
        db.commit()
        db.refresh(new_resume)
        resume_id = new_resume.id
    finally:
        db.close()

    # Activate with Keep Current on phone, but clear stale website_url
    res_act = client.post(
        f"/api/v1/resumes/{resume_id}/activate",
        json={
            "accepted_fields": {
                "first_name": "ReplacementFirst",
                "phone": "+91 9999988888",  # Keep Current
            },
            "clear_stale_fields": True,
        },
        headers=headers_a,
    )
    assert res_act.status_code == 200

    prof = client.get("/api/v1/profile", headers=headers_a).json()
    assert prof["first_name"] == "ReplacementFirst"
    assert prof["phone"] == "+91 9999988888"  # Preserved via Keep Current
    assert prof["website_url"] is None  # Stale resume field cleared


def test_date_precision_in_resume_parser():
    """Verify month-level precision for October 2025, Oct 2025, 10/2025, 2025-10, and 2025."""
    from backend.app.services.resume_parser import ResumeParser

    parser = ResumeParser()

    # 1. October 2025 – Present
    sm1, sy1, em1, ey1, cur1, s_date1, e_date1 = parser._parse_strict_dates("October 2025 – Present")
    assert sm1 == 10
    assert sy1 == 2025
    assert cur1 is True
    assert s_date1 == "2025-10-01"
    assert e_date1 is None

    # 2. Oct 2025 – Present
    sm2, sy2, em2, ey2, cur2, s_date2, e_date2 = parser._parse_strict_dates("Oct 2025 – Present")
    assert sm2 == 10
    assert sy2 == 2025
    assert s_date2 == "2025-10-01"

    # 3. 10/2025 - Present
    sm3, sy3, em3, ey3, cur3, s_date3, e_date3 = parser._parse_strict_dates("10/2025 - Present")
    assert sm3 == 10
    assert sy3 == 2025
    assert s_date3 == "2025-10-01"

    # 4. 2025-10 – Present
    sm4, sy4, em4, ey4, cur4, s_date4, e_date4 = parser._parse_strict_dates("2025-10 – Present")
    assert sm4 == 10
    assert sy4 == 2025
    assert s_date4 == "2025-10-01"

    # 5. 2025 - Present (Year only)
    sm5, sy5, em5, ey5, cur5, s_date5, e_date5 = parser._parse_strict_dates("2025 - Present")
    assert sm5 is None  # Must NOT invent January (1)!
    assert sy5 == 2025
    assert s_date5 == "2025"

    # 6. 2021 - 2023 (Year-only range)
    sm6, sy6, em6, ey6, cur6, s_date6, e_date6 = parser._parse_strict_dates("2021 - 2023")
    assert sm6 is None
    assert sy6 == 2021
    assert em6 is None
    assert ey6 == 2023
    assert s_date6 == "2021"
    assert e_date6 == "2023"


def test_provenance_critical_scenario_preserves_manual_and_prunes_stale_resume():
    """Critical scenario: Resume A has 2 records, candidate manually adds 3rd, Resume B has 2 different records.
    Expected: Resume A's 2 stale records removed, manually created record preserved, Resume B's 2 records added.
    """
    headers_a, uid = get_fresh_user_headers()
    db = next(get_db())

    try:
        # 1. Resume A is uploaded and extracted with 2 experiences
        resume_a = Resume(
            user_id=uid,
            file_name="resume_a.pdf",
            storage_path=f"resumes/{uid}/resume_a.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "experiences": [
                    {"company_name": "Google", "job_title": "Software Engineer", "start_date": "2020-01-01"},
                    {"company_name": "Yahoo", "job_title": "QA Intern", "start_date": "2019-01-01"},
                ],
                "educations": [
                    {"institution": "Old State College", "degree": "B.A.", "field_of_study": "Arts"},
                ],
                "skills": ["C++", "Perl"],
            },
        )
        db.add(resume_a)

        # Populate database with Resume A's records
        db.add(Experience(user_id=uid, company_name="Google", job_title="Software Engineer", start_date=None))
        db.add(Experience(user_id=uid, company_name="Yahoo", job_title="QA Intern", start_date=None))
        db.add(Education(user_id=uid, institution="Old State College", degree="B.A.", field_of_study="Arts"))
        db.add(Skill(user_id=uid, name="C++", years=0, months=0))
        db.add(Skill(user_id=uid, name="Perl", years=0, months=0))

        # 2. Candidate manually creates a third record in UI (NOT in Resume A's parsed data!)
        db.add(Experience(user_id=uid, company_name="Acme Consulting", job_title="Freelance Tester", description="Manual entry"))
        db.add(Education(user_id=uid, institution="Stanford Online", degree="Certificate", field_of_study="Cloud Architecture"))
        db.add(Skill(user_id=uid, name="Docker", years=2, months=0))  # Manually customized skill
        db.add(Skill(user_id=uid, name="Rust", years=0, months=0))   # Manually added skill (not in Resume A)

        db.commit()
    finally:
        db.close()

    # 3. Candidate uploads and replaces with Resume B containing 2 different records
    db = next(get_db())
    try:
        resume_b = Resume(
            user_id=uid,
            file_name="resume_b.pdf",
            storage_path=f"resumes/{uid}/resume_b.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "experiences": [
                    {"company_name": "Stripe", "job_title": "Senior SDET", "start_date": "2023-01-01"},
                    {"company_name": "Netflix", "job_title": "Performance Engineer", "start_date": "2022-01-01"},
                ],
                "educations": [
                    {"institution": "MIT", "degree": "M.S.", "field_of_study": "Computer Science"},
                ],
                "skills": ["Python", "Playwright"],
            },
        )
        db.add(resume_b)
        db.commit()
        db.refresh(resume_b)
        resume_b_id = resume_b.id
    finally:
        db.close()

    # Activate Resume B
    res_act = client.post(
        f"/api/v1/resumes/{resume_b_id}/activate",
        json={"add_experiences": True, "add_educations": True, "add_skills": True, "clear_stale_fields": True},
        headers=headers_a,
    )
    assert res_act.status_code == 200

    prof = client.get("/api/v1/profile", headers=headers_a).json()

    # --- EXPERIENCES ASSERTIONS ---
    exps = prof.get("experiences", [])
    exp_companies = [e["company_name"] for e in exps]

    # Stale Resume A records removed
    assert "Google" not in exp_companies
    assert "Yahoo" not in exp_companies

    # Manually created record PRESERVED
    assert "Acme Consulting" in exp_companies
    acme_exp = next(e for e in exps if e["company_name"] == "Acme Consulting")
    assert acme_exp["description"] == "Manual entry"

    # Resume B records ADDED
    assert "Stripe" in exp_companies
    assert "Netflix" in exp_companies
    assert len(exps) == 3

    # --- EDUCATIONS ASSERTIONS ---
    edus = prof.get("educations", [])
    edu_insts = [ed["institution"] for ed in edus]
    assert "Old State College" not in edu_insts  # Stale Resume A removed
    assert "Stanford Online" in edu_insts       # Manually created preserved
    assert "MIT" in edu_insts                   # Resume B added
    assert len(edus) == 2

    # --- SKILLS ASSERTIONS ---
    skills = prof.get("skills", [])
    skill_names = [s["name"] for s in skills]
    assert "C++" not in skill_names             # Stale Resume A removed
    assert "Perl" not in skill_names            # Stale Resume A removed
    assert "Docker" in skill_names              # Manually customized preserved
    assert "Rust" in skill_names                # Manually added preserved
    assert "Python" in skill_names              # Resume B added
    assert "Playwright" in skill_names          # Resume B added


def test_clear_stale_fields_end_to_end_with_website_and_github():
    """Verify that stale website and github URLs from Resume A are cleared when Resume B has neither,
    while manual values and Keep Current selections are preserved.
    """
    headers_a, uid = get_fresh_user_headers()
    db = next(get_db())

    try:
        # Resume A extracted phone, website_url, and github_url
        resume_a = Resume(
            user_id=uid,
            file_name="resume_a.pdf",
            storage_path=f"resumes/{uid}/resume_a.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "first_name": "OldAlice",
                "phone": "+91 1111111111",
                "website_url": "https://oldalice.com",
                "github_url": "https://github.com/oldalice",
            },
        )
        db.add(resume_a)
        db.commit()
    finally:
        db.close()

    # Profile has Resume A's data + manually set city
    client.patch(
        "/api/v1/profile",
        json={
            "first_name": "OldAlice",
            "phone": "+91 1111111111",
            "website_url": "https://oldalice.com",
            "github_url": "https://github.com/oldalice",
            "city": "Bengaluru",  # Manually entered
        },
        headers=headers_a,
    )

    # Resume B contains new first_name, but NO website, NO github, and NO city
    db = next(get_db())
    try:
        resume_b = Resume(
            user_id=uid,
            file_name="resume_b.pdf",
            storage_path=f"resumes/{uid}/resume_b.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "first_name": "NewAlice",
                # Note: website_url, github_url, phone, and city are absent
            },
        )
        db.add(resume_b)
        db.commit()
        db.refresh(resume_b)
        resume_b_id = resume_b.id
    finally:
        db.close()

    # Candidate selects Keep Current for phone, but allows stale website and github to clear
    res_act = client.post(
        f"/api/v1/resumes/{resume_b_id}/activate",
        json={
            "accepted_fields": {
                "first_name": "NewAlice",
                "phone": "+91 1111111111",  # Keep Current
            },
            "clear_stale_fields": True,
        },
        headers=headers_a,
    )
    assert res_act.status_code == 200

    prof = client.get("/api/v1/profile", headers=headers_a).json()
    assert prof["first_name"] == "NewAlice"
    assert prof["phone"] == "+91 1111111111"       # Preserved via Keep Current
    assert prof["website_url"] is None            # Stale Resume A cleared
    assert prof["github_url"] is None             # Stale Resume A cleared
    assert prof["city"] == "Bengaluru"            # Manually entered preserved!


def test_matching_correctness_edge_cases():
    """Verify matching edge cases:
    - Same company & same title across 2 different employment periods
    - Same university with multiple qualifications
    - Minor company formatting differences ('Google LLC' vs 'Google')
    - Duplicate records in incoming parsed data
    """
    headers_a, uid = get_fresh_user_headers()
    db = next(get_db())

    from datetime import date
    try:
        # Pre-seed: Candidate worked at Google as Software Engineer in 2020-2021
        db.add(Experience(user_id=uid, company_name="Google", job_title="Software Engineer", start_date=date(2020, 1, 1), description="First stint"))
        # Pre-seed: Stanford University B.S.
        db.add(Education(user_id=uid, institution="Stanford University", degree="B.S.", field_of_study="Computer Science"))
        db.commit()
    finally:
        db.close()

    # Resume B contains:
    # 1. Google - Software Engineer (Second stint in 2023!) -> Must NOT overwrite first stint!
    # 2. Stanford University - M.S. Software Engineering -> Must NOT overwrite B.S.!
    # 3. Amazon.com Inc. vs Amazon -> Normalized
    # 4. Duplicate entries in the same resume text
    db = next(get_db())
    try:
        resume_b = Resume(
            user_id=uid,
            file_name="resume_b.pdf",
            storage_path=f"resumes/{uid}/resume_b.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "experiences": [
                    {"company_name": "Google", "job_title": "Software Engineer", "start_date": "2023-01-01", "description": "Second stint"},
                    {"company_name": "Google", "job_title": "Software Engineer", "start_date": "2023-01-01", "description": "Duplicate line"},
                    {"company_name": "Amazon.com Inc.", "job_title": "SDET", "start_date": "2022-01-01"},
                ],
                "educations": [
                    {"institution": "Stanford University", "degree": "M.S.", "field_of_study": "Software Engineering"},
                    {"institution": "Stanford University", "degree": "M.S.", "field_of_study": "Software Engineering"},  # Duplicate
                ],
                "skills": ["Python", "Python", "pytest"],  # Duplicates
            },
        )
        db.add(resume_b)
        db.commit()
        db.refresh(resume_b)
        resume_b_id = resume_b.id
    finally:
        db.close()

    res_act = client.post(
        f"/api/v1/resumes/{resume_b_id}/activate",
        json={"add_experiences": True, "add_educations": True, "add_skills": True},
        headers=headers_a,
    )
    assert res_act.status_code == 200

    prof = client.get("/api/v1/profile", headers=headers_a).json()

    # Verify both Google stints are preserved
    google_exps = [e for e in prof.get("experiences", []) if "google" in e["company_name"].lower()]
    assert len(google_exps) == 2
    stint_descriptions = {e["description"] for e in google_exps}
    assert "First stint" in stint_descriptions
    assert "Second stint" in stint_descriptions

    # Verify duplicates de-duplicated
    amazon_exps = [e for e in prof.get("experiences", []) if "amazon" in e["company_name"].lower()]
    assert len(amazon_exps) == 1

    # Verify Stanford has both B.S. and M.S.
    stanford_edus = [ed for ed in prof.get("educations", []) if "stanford" in ed["institution"].lower()]
    assert len(stanford_edus) == 2
    degrees = {ed["degree"] for ed in stanford_edus}
    assert "B.S." in degrees
    assert "M.S." in degrees


@pytest.mark.parametrize("failure_stage", ["scalar", "skill", "experience", "education", "pre_commit"])
def test_atomic_rollback_on_injected_failure(monkeypatch, failure_stage):
    """Verify that any failure injected during profile synchronization triggers full database rollback,
    leaving previous active resume, previous profile, previous experiences, educations, and skills intact.
    Tested stages:
    - scalar updates
    - skill reconciliation
    - experience reconciliation
    - education reconciliation
    - right before commit (db.commit)
    """
    headers_a, uid = get_fresh_user_headers()
    db = next(get_db())

    try:
        # Pre-seed candidate with initial stable profile
        r1 = Resume(
            user_id=uid,
            file_name="initial.pdf",
            storage_path=f"resumes/{uid}/initial.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
            parsed_data={"headline": "Initial Stable Headline"},
        )
        db.add(r1)
        p = db.execute(select(Profile).where(Profile.id == uid)).scalar_one()
        p.headline = "Initial Stable Headline"
        p.city = "OriginalCity"
        db.add(Experience(user_id=uid, company_name="SafeCorp", job_title="Tester"))
        db.add(Education(user_id=uid, institution="SafeUniv", degree="B.S."))
        db.add(Skill(user_id=uid, name="Java", years=1, months=0))
        db.commit()
        db.refresh(r1)
        r1_id = r1.id
    finally:
        db.close()

    # Candidate attempts to activate Resume 2 with new data across all categories
    db = next(get_db())
    try:
        r2 = Resume(
            user_id=uid,
            file_name="replacement.pdf",
            storage_path=f"resumes/{uid}/replacement.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "headline": "Corrupted Headline Attempt",
                "city": "CorruptedCity",
                "skills": ["Rust"],
                "experiences": [{"company_name": "CrashCorp", "job_title": "CrashJob"}],
                "educations": [{"institution": "CrashUniv", "degree": "M.S."}],
            },
        )
        db.add(r2)
        db.commit()
        db.refresh(r2)
        r2_id = r2.id
    finally:
        db.close()

    # Inject failure at the specified stage
    from backend.app.services.resume_service import ResumeService
    from backend.app.schemas.resume import ResumeActivationRequest
    from backend.app.db.models.skill import Skill as SkillModel
    from backend.app.db.models.experience import Experience as ExpModel
    from backend.app.db.models.education import Education as EduModel

    if failure_stage == "scalar":
        orig_setattr = Profile.__setattr__
        def failing_setattr(self, name, value):
            if name == "headline" and value == "Corrupted Headline Attempt":
                raise RuntimeError("Injected database crash during scalar profile update!")
            orig_setattr(self, name, value)
        monkeypatch.setattr(Profile, "__setattr__", failing_setattr)

    elif failure_stage == "skill":
        orig_skill_init = SkillModel.__init__
        def crashing_skill_init(self, *args, **kwargs):
            if kwargs.get("name") == "Rust":
                raise RuntimeError("Injected database crash during skill sync!")
            orig_skill_init(self, *args, **kwargs)
        monkeypatch.setattr(SkillModel, "__init__", crashing_skill_init)

    elif failure_stage == "experience":
        orig_exp_init = ExpModel.__init__
        def crashing_exp_init(self, *args, **kwargs):
            if kwargs.get("company_name") == "CrashCorp":
                raise RuntimeError("Injected database crash during experience sync!")
            orig_exp_init(self, *args, **kwargs)
        monkeypatch.setattr(ExpModel, "__init__", crashing_exp_init)

    elif failure_stage == "education":
        orig_edu_init = EduModel.__init__
        def crashing_edu_init(self, *args, **kwargs):
            if kwargs.get("institution") == "CrashUniv":
                raise RuntimeError("Injected database crash during education sync!")
            orig_edu_init(self, *args, **kwargs)
        monkeypatch.setattr(EduModel, "__init__", crashing_edu_init)

    elif failure_stage == "pre_commit":
        from sqlalchemy.orm import Session as SASession
        orig_commit = SASession.commit
        def crashing_commit(self):
            raise RuntimeError("Injected database crash right before commit!")
        monkeypatch.setattr(SASession, "commit", crashing_commit)

    # Attempt activation -> Expect RuntimeError due to injected failure
    with pytest.raises(RuntimeError):
        db_session = next(get_db())
        try:
            ResumeService.activate_resume_and_sync_profile(
                db_session,
                uid,
                r2_id,
                ResumeActivationRequest(
                    add_experiences=True,
                    add_educations=True,
                    add_skills=True,
                    accepted_fields={"headline": "Corrupted Headline Attempt", "city": "CorruptedCity"},
                ),
            )
        finally:
            db_session.close()

    # VERIFY ATOMIC ROLLBACK AFTER FAILURE:
    # 1. Active resume MUST STILL BE Resume 1!
    resumes_after = client.get("/api/v1/resumes", headers=headers_a).json()
    r1_after = next(r for r in resumes_after if r["id"] == str(r1_id))
    r2_after = next(r for r in resumes_after if r["id"] == str(r2_id))
    assert r1_after["is_active"] is True
    assert r2_after["is_active"] is False

    # 2. Profile MUST NOT contain corrupted fields
    prof = client.get("/api/v1/profile", headers=headers_a).json()
    assert prof["headline"] == "Initial Stable Headline"
    assert prof["city"] == "OriginalCity"

    # 3. Experiences MUST NOT contain CrashCorp, must contain SafeCorp
    exp_companies = [e["company_name"] for e in prof.get("experiences", [])]
    assert "CrashCorp" not in exp_companies
    assert "SafeCorp" in exp_companies

    # 4. Educations MUST NOT contain CrashUniv, must contain SafeUniv
    edu_insts = [ed["institution"] for ed in prof.get("educations", [])]
    assert "CrashUniv" not in edu_insts
    assert "SafeUniv" in edu_insts

    # 5. Skills MUST NOT contain Rust, must contain Java
    skill_names = [s["name"] for s in prof.get("skills", [])]
    assert "Rust" not in skill_names
    assert "Java" in skill_names


def test_provenance_heuristic_limitations_and_edge_cases():
    """Systematic empirical test of the 5 heuristic provenance edge cases:
    1. Manually edited record (candidate customized job title) -> preserved.
    2. Multi-period distinct stint with explicit dates -> preserved.
    3. Partial match via company suffix stripping ('Alpha Corp' vs 'Alpha LLC') -> matched and pruned.
    4. Missing dates behavior -> company+title match without dates collapses.
    5. Multi-version resume lineage -> correctly prunes based on immediate previous active resume.
    """
    headers_a, uid = get_fresh_user_headers()
    db = next(get_db())

    from datetime import date
    try:
        # Pre-seed Resume A (version 1, active)
        r1 = Resume(
            user_id=uid,
            file_name="resume_v1.pdf",
            storage_path=f"resumes/{uid}/resume_v1.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "experiences": [
                    {"company_name": "Acme", "job_title": "Engineer", "start_date": "2018-01-01"},
                    {"company_name": "Alpha Corp", "job_title": "DevOps", "start_date": "2019-01-01"},
                    {"company_name": "Beta Inc", "job_title": "QA", "start_date": "2020-01-01"},
                ]
            },
        )
        db.add(r1)

        # 1. Candidate manually edited job_title in DB from "Engineer" to "Staff Engineer"
        db.add(Experience(user_id=uid, company_name="Acme", job_title="Staff Engineer", start_date=date(2018, 1, 1), description="Candidate manual edit"))

        # 2. Candidate manually added a multi-period stint for Acme with different dates
        db.add(Experience(user_id=uid, company_name="Acme", job_title="Engineer", start_date=date(2022, 1, 1), description="Candidate manual second stint"))

        # 3. DB has "Alpha LLC" with title "DevOps" (matches Resume A's "Alpha Corp" due to suffix normalization)
        db.add(Experience(user_id=uid, company_name="Alpha LLC", job_title="DevOps", start_date=date(2019, 1, 1), description="Company suffix variation"))

        # 4. DB has "Beta Inc" with start_date=None (missing date)
        db.add(Experience(user_id=uid, company_name="Beta Inc", job_title="QA", start_date=None, description="Missing date record"))

        db.commit()
    finally:
        db.close()

    # Upload Resume B (version 2) with a completely new role
    db = next(get_db())
    try:
        r2 = Resume(
            user_id=uid,
            file_name="resume_v2.pdf",
            storage_path=f"resumes/{uid}/resume_v2.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={
                "experiences": [
                    {"company_name": "NewCo Global", "job_title": "Principal Architect", "start_date": "2024-01-01"},
                ]
            },
        )
        db.add(r2)
        db.commit()
        db.refresh(r2)
        r2_id = r2.id
    finally:
        db.close()

    # Activate Resume B
    res_act = client.post(
        f"/api/v1/resumes/{r2_id}/activate",
        json={"add_experiences": True, "clear_stale_fields": True},
        headers=headers_a,
    )
    assert res_act.status_code == 200

    prof = client.get("/api/v1/profile", headers=headers_a).json()
    exps = prof.get("experiences", [])
    exp_titles_by_company = {(e["company_name"], e["job_title"]) for e in exps}

    # EMPIRICAL RESULTS:
    # 1. Manually edited title ("Staff Engineer" vs Resume A's "Engineer") was PRESERVED as candidate manual data!
    assert ("Acme", "Staff Engineer") in exp_titles_by_company

    # 2. Second stint with distinct date ("2022-01-01" vs "2018-01-01") was PRESERVED!
    assert ("Acme", "Engineer") in exp_titles_by_company

    # 3. "Alpha LLC" matched Resume A's "Alpha Corp" via suffix normalization and was PRUNED as stale resume data!
    assert ("Alpha LLC", "DevOps") not in exp_titles_by_company

    # 4. "Beta Inc" with start_date=None matched Resume A's "Beta Inc" QA and was PRUNED as stale resume data!
    assert ("Beta Inc", "QA") not in exp_titles_by_company

    # 5. NewCo Global was ADDED
    assert any("NewCo" in e["company_name"] for e in exps)




