"""Comprehensive Test Suite for Gate 1 Resume Workflow Integration:
Two-Resume Replacement, Profile Synchronization, Provenance, Verification Enforcement,
Storage Failure Fail-Closed Protection, and Cross-User Isolation.
"""

from __future__ import annotations

import io
import os
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
from backend.app.services.resume_service import ResumeService, get_local_resume_path
from tests.conftest import create_test_token

client = TestClient(app)

RESUME_A_PATH = "/Users/janamjay/.gemini/antigravity/brain/4a52242c-4013-4c08-99f1-5eafac1ab5f3/.user_uploaded/media_1793521881834_5f85ce61.pdf"
RESUME_B_PATH = "/Users/janamjay/.gemini/antigravity/brain/4a52242c-4013-4c08-99f1-5eafac1ab5f3/.user_uploaded/media_1793521899095_bc239f10.pdf"


def get_authenticated_user(email_prefix: str = "candidate"):
    """Helper to generate a clean, isolated user with active policy acceptance and auth token."""
    uid = uuid.uuid4()
    db = next(get_db())
    try:
        profile = Profile(id=uid, email=f"{email_prefix}_{uid.hex[:8]}@rolepilot.test")
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


def test_two_resume_replacement_and_profile_synchronization_17_steps():
    """Mandatory 17-Step Two-Resume Replacement and Profile Synchronization Test."""
    headers, uid = get_authenticated_user("sync_user")

    assert os.path.isfile(RESUME_A_PATH), f"Fixture Resume A missing at {RESUME_A_PATH}"
    assert os.path.isfile(RESUME_B_PATH), f"Fixture Resume B missing at {RESUME_B_PATH}"

    with open(RESUME_A_PATH, "rb") as f:
        pdf_a_bytes = f.read()

    with open(RESUME_B_PATH, "rb") as f:
        pdf_b_bytes = f.read()

    # -------------------------------------------------------------------------
    # Step 1: Upload Resume A
    # -------------------------------------------------------------------------
    files_a = {"file": ("Resume_A_Generic.pdf", io.BytesIO(pdf_a_bytes), "application/pdf")}
    res_upload_a = client.post("/api/v1/resumes/upload", files=files_a, headers=headers)
    assert res_upload_a.status_code == 201, f"Resume A upload failed: {res_upload_a.text}"
    resume_a_data = res_upload_a.json()
    id_a = resume_a_data["id"]

    # -------------------------------------------------------------------------
    # Step 2: Verify physical storage & PDF validation of Resume A
    # -------------------------------------------------------------------------
    assert resume_a_data["is_valid_document"] is True
    assert resume_a_data["document_status"] == "verified"
    assert resume_a_data["file_mime_type"] == "application/pdf"
    local_path_a = get_local_resume_path(uid, uuid.UUID(id_a))
    assert local_path_a.is_file(), "Resume A must exist on physical disk"
    assert local_path_a.stat().st_size == len(pdf_a_bytes)

    # -------------------------------------------------------------------------
    # Step 3: Extract and synchronize Resume A's profile information
    # -------------------------------------------------------------------------
    res_sync_a = client.post(
        f"/api/v1/resumes/{id_a}/activate",
        json={"add_skills": True, "add_experiences": True, "add_educations": True, "clear_stale_fields": True},
        headers=headers,
    )
    assert res_sync_a.status_code == 200

    prof_a = client.get("/api/v1/profile", headers=headers).json()
    assert prof_a["phone"] == "617-555-1234"
    assert prof_a["headline"] == "Host"

    db = next(get_db())
    try:
        skills_a = db.execute(select(Skill.name).where(Skill.user_id == uid)).scalars().all()
        assert "Go" in skills_a
        exps_a = db.execute(select(Experience.job_title).where(Experience.user_id == uid)).scalars().all()
        assert any("Host" in j for j in exps_a)
    finally:
        db.close()

    # -------------------------------------------------------------------------
    # Step 4: Confirm Resume A is the active resume
    # -------------------------------------------------------------------------
    res_list_1 = client.get("/api/v1/resumes", headers=headers).json()
    rec_a = next(r for r in res_list_1 if r["id"] == id_a)
    assert rec_a["is_active"] is True
    assert rec_a["version"] == 1

    # -------------------------------------------------------------------------
    # Step 5: Upload Resume B as a separate replacement
    # -------------------------------------------------------------------------
    files_b = {"file": ("Resume_B_Janmejay.pdf", io.BytesIO(pdf_b_bytes), "application/pdf")}
    res_replace_b = client.post("/api/v1/resumes/replace", files=files_b, headers=headers)
    assert res_replace_b.status_code == 201, f"Resume B replacement failed: {res_replace_b.text}"
    replace_data = res_replace_b.json()
    resume_b_data = replace_data["new_resume"]
    id_b = resume_b_data["id"]

    assert resume_b_data["version"] == 2
    assert resume_b_data["is_active"] is False  # Must NOT be active yet!

    # -------------------------------------------------------------------------
    # Step 6: Verify Resume B before activation
    # -------------------------------------------------------------------------
    assert resume_b_data["is_valid_document"] is True
    assert resume_b_data["document_status"] == "verified"
    local_path_b = get_local_resume_path(uid, uuid.UUID(id_b))
    assert local_path_b.is_file(), "Resume B must exist on physical disk"

    # Confirm Resume A is STILL the active resume
    res_list_2 = client.get("/api/v1/resumes", headers=headers).json()
    rec_a_mid = next(r for r in res_list_2 if r["id"] == id_a)
    rec_b_mid = next(r for r in res_list_2 if r["id"] == id_b)
    assert rec_a_mid["is_active"] is True
    assert rec_b_mid["is_active"] is False

    # -------------------------------------------------------------------------
    # Step 7: Activate Resume B
    # -------------------------------------------------------------------------
    res_act_b = client.post(
        f"/api/v1/resumes/{id_b}/activate",
        json={"add_skills": True, "add_experiences": True, "add_educations": True, "clear_stale_fields": True},
        headers=headers,
    )
    assert res_act_b.status_code == 200

    # -------------------------------------------------------------------------
    # Step 8: Confirm active-resume reference points to Resume B
    # -------------------------------------------------------------------------
    res_list_3 = client.get("/api/v1/resumes", headers=headers).json()
    rec_a_post = next(r for r in res_list_3 if r["id"] == id_a)
    rec_b_post = next(r for r in res_list_3 if r["id"] == id_b)
    assert rec_b_post["is_active"] is True
    assert rec_a_post["is_active"] is False

    # -------------------------------------------------------------------------
    # Step 9: Confirm user profile reflects Resume B's information
    # -------------------------------------------------------------------------
    prof_b = client.get("/api/v1/profile", headers=headers).json()
    assert prof_b["first_name"] == "Janmejay"
    assert prof_b["last_name"] == "Kumar Singh"
    assert prof_b["phone"] == "+91 9123159508"
    assert prof_b["city"] == "Noida"
    assert prof_b["headline"] == "Software Test Engineer"
    assert prof_b["target_role"] == "Software Test Engineer"
    assert prof_b["linkedin_url"] == "https://linkedin.com/in/thejanmejaysingh"

    db = next(get_db())
    try:
        skills_b = db.execute(select(Skill.name).where(Skill.user_id == uid)).scalars().all()
        assert "Selenium WebDriver" in skills_b
        assert "Java" in skills_b
        assert "Postman" in skills_b

        exps_b = db.execute(select(Experience.company_name).where(Experience.user_id == uid)).scalars().all()
        assert any("Appypie" in c for c in exps_b)
        assert any("gNxtSystems" in c for c in exps_b)

        edus_b = db.execute(select(Education.institution).where(Education.user_id == uid)).scalars().all()
        assert any("Mangalmay" in i for i in edus_b)
    finally:
        db.close()

    # -------------------------------------------------------------------------
    # Step 10: Confirm Resume A's old values are not retained where Resume B replaced them
    # -------------------------------------------------------------------------
    assert prof_b["headline"] != "Host"
    assert prof_b["phone"] != "617-555-1234"
    assert "TFI Fridays" not in [e.company_name for e in db.execute(select(Experience).where(Experience.user_id == uid)).scalars().all()]

    # -------------------------------------------------------------------------
    # Step 11: Switch back to Resume A
    # -------------------------------------------------------------------------
    res_switch_a = client.post(
        f"/api/v1/resumes/{id_a}/activate",
        json={"add_skills": True, "add_experiences": True, "add_educations": True, "clear_stale_fields": True},
        headers=headers,
    )
    assert res_switch_a.status_code == 200

    # -------------------------------------------------------------------------
    # Step 12: Confirm profile returns to Resume A's values
    # -------------------------------------------------------------------------
    prof_re_a = client.get("/api/v1/profile", headers=headers).json()
    assert prof_re_a["first_name"] == "First"
    assert prof_re_a["phone"] == "617-555-1234"
    assert prof_re_a["headline"] == "Host"

    # -------------------------------------------------------------------------
    # Step 13: Switch again to Resume B
    # -------------------------------------------------------------------------
    res_switch_b = client.post(
        f"/api/v1/resumes/{id_b}/activate",
        json={"add_skills": True, "add_experiences": True, "add_educations": True, "clear_stale_fields": True},
        headers=headers,
    )
    assert res_switch_b.status_code == 200

    # -------------------------------------------------------------------------
    # Step 14: Refresh the frontend / retrieve profile again
    # -------------------------------------------------------------------------
    prof_re_b = client.get("/api/v1/profile", headers=headers).json()
    assert prof_re_b["first_name"] == "Janmejay"
    assert prof_re_b["headline"] == "Software Test Engineer"
    assert prof_re_b["phone"] == "+91 9123159508"

    # -------------------------------------------------------------------------
    # Step 15: Log out and log in again (simulate fresh session)
    # -------------------------------------------------------------------------
    new_token = create_test_token(uid)
    headers_new_session = {"Authorization": f"Bearer {new_token}"}
    prof_session_2 = client.get("/api/v1/profile", headers=headers_new_session).json()
    assert prof_session_2["first_name"] == "Janmejay"
    assert prof_session_2["phone"] == "+91 9123159508"

    # -------------------------------------------------------------------------
    # Step 16: Verify both resume versions remain available in history
    # -------------------------------------------------------------------------
    res_history = client.get("/api/v1/resumes", headers=headers).json()
    assert len(res_history) == 2
    v1_item = next(r for r in res_history if r["version"] == 1)
    v2_item = next(r for r in res_history if r["version"] == 2)
    assert v1_item["id"] == id_a
    assert v2_item["id"] == id_b
    assert v1_item["is_active"] is False
    assert v2_item["is_active"] is True

    # -------------------------------------------------------------------------
    # Step 17: Restoring older version does not overwrite or mutate historical versions
    # -------------------------------------------------------------------------
    assert v1_item["file_name"] == "Resume_A_Generic.pdf"
    assert v2_item["file_name"] == "Resume_B_Janmejay.pdf"
    # Ensure physical files for both remain intact on disk
    assert local_path_a.is_file()
    assert local_path_b.is_file()


def test_missing_field_defined_behavior():
    """Verify behavior when Resume B omits fields present in Resume A."""
    headers, uid = get_authenticated_user("missing_fields_user")

    # Resume A provides first_name, phone, city, headline
    db = next(get_db())
    try:
        r_a = Resume(
            user_id=uid,
            file_name="res_a.pdf",
            storage_path=f"resumes/{uid}/res_a.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
            parsed_data={"first_name": "Alice", "phone": "555-0101", "city": "Boston", "headline": "Engineer"},
        )
        db.add(r_a)
        db.commit()
    finally:
        db.close()

    # Pre-populate profile with Resume A's data
    client.patch("/api/v1/profile", json={"first_name": "Alice", "phone": "555-0101", "city": "Boston", "headline": "Engineer"}, headers=headers)

    # Resume B provides first_name="Bob", headline="Lead", but OMITS phone and city
    db = next(get_db())
    try:
        r_b = Resume(
            user_id=uid,
            file_name="res_b.pdf",
            storage_path=f"resumes/{uid}/res_b.pdf",
            version=2,
            is_active=False,
            is_valid_document=True,
            document_status="verified",
            parsed_data={"first_name": "Bob", "headline": "Lead"},
        )
        db.add(r_b)
        db.commit()
        r_b_id = r_b.id
    finally:
        db.close()

    # Case 1: clear_stale_fields=True -> stale resume-derived fields (phone, city) are cleared
    res_act = client.post(
        f"/api/v1/resumes/{r_b_id}/activate",
        json={"clear_stale_fields": True},
        headers=headers,
    )
    assert res_act.status_code == 200

    prof = client.get("/api/v1/profile", headers=headers).json()
    assert prof["first_name"] == "Bob"
    assert prof["headline"] == "Lead"
    assert prof["phone"] is None, "Stale phone from Resume A must be cleared when clear_stale_fields=True"
    assert prof["city"] is None, "Stale city from Resume A must be cleared when clear_stale_fields=True"


def test_failed_replacement_preserves_previous_active_and_profile():
    """Verify that corrupt, non-PDF, or unverified replacements fail closed without corrupting state."""
    headers, uid = get_authenticated_user("failure_test_user")

    # 1. Establish valid active Resume 1
    valid_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    )
    res_v1 = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("v1.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers=headers,
    )
    assert res_v1.status_code == 201
    v1_id = res_v1.json()["id"]

    # Pre-populate profile
    client.patch("/api/v1/profile", json={"first_name": "StableUser", "headline": "Principal QA"}, headers=headers)

    # 2. Corrupt PDF upload attempt
    corrupt_bytes = b"This is not a PDF at all, just plain text corruption."
    res_corrupt = client.post(
        "/api/v1/resumes/replace",
        files={"file": ("corrupt.pdf", io.BytesIO(corrupt_bytes), "application/pdf")},
        headers=headers,
    )
    assert res_corrupt.status_code == 400
    assert "Invalid PDF" in res_corrupt.json()["detail"]

    # 3. Attempting to activate an unverified resume directly via API must be rejected
    db = next(get_db())
    try:
        unverified_id = uuid.uuid4()
        unverified_resume = Resume(
            id=unverified_id,
            user_id=uid,
            file_name="unverified.pdf",
            storage_path=f"resumes/{uid}/{unverified_id}.pdf",
            version=99,
            is_active=False,
            is_valid_document=False,
            document_status="pending_verification",
        )
        db.add(unverified_resume)
        db.commit()
    finally:
        db.close()

    res_act_unverified = client.post(
        f"/api/v1/resumes/{unverified_id}/activate",
        json={},
        headers=headers,
    )
    assert res_act_unverified.status_code == 400
    assert "Cannot activate unverified resume" in res_act_unverified.json()["detail"]

    # 4. Confirm original resume is STILL the active resume
    active_res = client.get("/api/v1/resumes", headers=headers).json()
    active_record = next(r for r in active_res if r["is_active"] is True)
    assert active_record["id"] == v1_id

    # 5. Confirm profile remained intact
    prof = client.get("/api/v1/profile", headers=headers).json()
    assert prof["first_name"] == "StableUser"
    assert prof["headline"] == "Principal QA"


def test_cross_user_isolation():
    """Verify that User A operations never leak to or mutate User B's state."""
    headers_a, uid_a = get_authenticated_user("user_a")
    headers_b, uid_b = get_authenticated_user("user_b")

    valid_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    )

    # User A uploads resume
    res_a = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("user_a_cv.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        headers=headers_a,
    )
    assert res_a.status_code == 201
    id_a = res_a.json()["id"]

    # User B cannot download User A's file
    res_file_leak = client.get(f"/api/v1/resumes/{id_a}/file", headers=headers_b)
    assert res_file_leak.status_code == 404

    # User B cannot activate User A's resume
    res_act_leak = client.post(f"/api/v1/resumes/{id_a}/activate", json={}, headers=headers_b)
    assert res_act_leak.status_code == 404

    # User B cannot delete User A's resume
    res_del_leak = client.delete(f"/api/v1/resumes/{id_a}", headers=headers_b)
    assert res_del_leak.status_code == 404


def test_unsafe_placeholder_pdf_elimination():
    """Verify that missing physical files return 404 instead of generating fake placeholder PDFs."""
    headers, uid = get_authenticated_user("missing_storage_user")

    missing_resume_id = uuid.uuid4()
    db = next(get_db())
    try:
        # Create record in DB pointing to non-existent storage path
        missing_resume = Resume(
            id=missing_resume_id,
            user_id=uid,
            file_name="ghost_document.pdf",
            storage_path=f"resumes/{uid}/non_existent_file.pdf",
            version=1,
            is_active=True,
            is_valid_document=True,
            document_status="verified",
        )
        db.add(missing_resume)
        db.commit()
    finally:
        db.close()

    # Attempt to stream the file: MUST return 404 Not Found, never 200 with fake PDF
    res_stream = client.get(f"/api/v1/resumes/{missing_resume_id}/file", headers=headers)
    assert res_stream.status_code == 404
    assert "not found in physical storage" in res_stream.json()["detail"].lower()

import threading

def test_concurrency_and_data_consistency_scenarios():
    """Verify concurrency and data consistency requirements from Section 8."""
    headers, uid = get_authenticated_user("concur_resume_user")

    valid_pdf_1 = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    )
    valid_pdf_2 = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    )

    # 1. Upload Resume 1
    res1 = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("v1.pdf", io.BytesIO(valid_pdf_1), "application/pdf")},
        headers=headers,
    )
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    # 2. Upload Resume 2 as replacement
    res2 = client.post(
        "/api/v1/resumes/replace",
        files={"file": ("v2.pdf", io.BytesIO(valid_pdf_2), "application/pdf")},
        headers=headers,
    )
    assert res2.status_code == 201
    id2 = res2.json()["new_resume"]["id"]

    # 3. Concurrent Activation Requests for Resume 1 and Resume 2
    results = []

    def activate_target(res_id):
        r = client.post(
            f"/api/v1/resumes/{res_id}/activate",
            json={"add_skills": True, "add_experiences": True, "add_educations": True},
            headers=headers,
        )
        results.append((res_id, r.status_code))

    t1 = threading.Thread(target=activate_target, args=(id1,))
    t2 = threading.Thread(target=activate_target, args=(id2,))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Both activation requests must process safely with status 200
    assert len(results) == 2
    assert all(code == 200 for _, code in results)

    # Database consistency check: Exactly ONE active resume in database
    db = next(get_db())
    try:
        active_resumes = db.execute(
            select(Resume).where(Resume.user_id == uid, Resume.is_active == True)
        ).scalars().all()
        assert len(active_resumes) == 1, f"Expected exactly 1 active resume, found: {len(active_resumes)}"
    finally:
        db.close()

    # 4. Deletion of Active Resume with Automatic Fallback
    active_id = active_resumes[0].id
    other_id = id1 if str(active_id) == str(id2) else id2

    # Delete the active resume
    res_del = client.delete(f"/api/v1/resumes/{active_id}", headers=headers)
    assert res_del.status_code == 204

    # The other verified resume must automatically become active
    db = next(get_db())
    try:
        remaining_resumes = db.execute(
            select(Resume).where(Resume.user_id == uid)
        ).scalars().all()
        assert len(remaining_resumes) == 1
        assert remaining_resumes[0].id == uuid.UUID(other_id)
        assert remaining_resumes[0].is_active is True, "Remaining verified resume must become active upon active deletion fallback"
    finally:
        db.close()

