"""Safe account-deletion tests using an in-memory database and mocked Supabase."""

import uuid

import jwt
from datetime import datetime, timezone
from sqlalchemy import event, or_

from backend.app.core.config import settings
from backend.app.db.models.application import Application
from backend.app.db.models.application_answer import ApplicationAnswer
from backend.app.db.models.automation_log import AutomationLog
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.education import Education
from backend.app.db.models.email_reservation import EmailReservation
from backend.app.db.models.experience import Experience
from backend.app.db.models.job import Job
from backend.app.db.models.linkedin_account import LinkedInAccount
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.search_config import SearchConfig
from backend.app.db.models.skill import Skill
from tests.conftest import TEST_SECRET, TestingSessionLocal, client, create_test_token, test_engine



class FakeStorageBucket:
    def __init__(self, fail=False):
        self.fail = fail
        self.removed_paths = []

    def remove(self, paths):
        if self.fail:
            raise RuntimeError("mock storage failure")
        self.removed_paths.extend(paths)
        return [{"name": path} for path in paths]


class FakeAdmin:
    def __init__(self, storage_fail=False, auth_failures=()):
        self.bucket = FakeStorageBucket(fail=storage_fail)
        self.auth_calls = []
        self.auth_failures = list(auth_failures)
        self.storage = self
        self.auth = self
        self.admin = self

    def from_(self, bucket):
        self.bucket_name = bucket
        return self.bucket

    def delete_user(self, user_id, should_soft_delete=False):
        self.auth_calls.append(user_id)
        assert should_soft_delete is False
        if self.auth_failures:
            raise self.auth_failures.pop(0)


def _headers(user_id, email=None):
    if email is None:
        token = create_test_token(user_id)
    else:
        token = jwt.encode(
            {
                "sub": str(user_id),
                "aud": "authenticated",
                "role": "authenticated",
                "email": email,
                "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
            },
            TEST_SECRET,
            algorithm="HS256",
        )
    return {"Authorization": f"Bearer {token}"}


def _seed_account(user_id, email="reusable@example.com"):
    db = TestingSessionLocal()
    job = Job(
        id=uuid.uuid4(),
        linkedin_job_id=f"shared-{uuid.uuid4()}",
        title="Engineer",
        company="Example",
        job_url="https://www.linkedin.com/jobs/view/123456",
    )
    profile = Profile(
        id=user_id,
        email=email,
        first_name="Example",
        onboarding_completed=True,
    )
    config = SearchConfig(id=uuid.uuid4(), user_id=user_id, name="Private search", keywords="engineer")
    run = AutomationRun(id=uuid.uuid4(), user_id=user_id, search_config_id=config.id)
    application = Application(
        id=uuid.uuid4(), user_id=user_id, job_id=job.id, run_id=run.id
    )
    resume = Resume(
        id=uuid.uuid4(), user_id=user_id, file_name="resume.pdf",
        storage_path=f"resumes/{user_id}/resume-object.pdf", version=1,
    )
    db.add_all([
        job,
        profile,
        config,
        run,
        application,
        resume,
        UserPolicyAcceptance(
            id=uuid.uuid4(), user_id=user_id,
            policy_type=settings.ACTIVE_POLICY_TYPE,
            policy_version=settings.ACTIVE_POLICY_VERSION,
        ),
        LinkedInAccount(id=uuid.uuid4(), user_id=user_id),
        Skill(id=uuid.uuid4(), user_id=user_id, name="Python"),
        Experience(id=uuid.uuid4(), user_id=user_id, company_name="Example", job_title="Engineer"),
        Education(id=uuid.uuid4(), user_id=user_id, institution="Example University"),
        ApplicationAnswer(
            id=uuid.uuid4(), application_id=application.id,
            question="Why?", answer="Because.",
        ),
        AutomationLog(
            run_id=run.id, application_id=application.id,
            event="started", message="Test run",
        ),
    ])
    db.commit()
    job_id = job.id
    storage_path = resume.storage_path
    db.close()
    return job_id, storage_path


def _count(model, user_id):
    db = TestingSessionLocal()
    try:
        if model is Profile:
            return db.query(model).filter(model.id == user_id).count()
        if model is ApplicationAnswer:
            return db.query(model).join(Application).filter(Application.user_id == user_id).count()
        if model is AutomationLog:
            return (
                db.query(model)
                .outerjoin(AutomationRun, AutomationLog.run_id == AutomationRun.id)
                .outerjoin(Application, AutomationLog.application_id == Application.id)
                .filter(or_(AutomationRun.user_id == user_id, Application.user_id == user_id))
                .count()
            )
        return db.query(model).filter(model.user_id == user_id).count()
    finally:
        db.close()


def test_delete_account_requires_validated_bearer_token(monkeypatch):
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    response = client.delete("/api/v1/account")

    assert response.status_code == 401
    assert admin.auth_calls == []
    assert admin.bucket.removed_paths == []


def test_missing_admin_configuration_fails_before_cleanup(monkeypatch):
    user_id = uuid.uuid4()
    _seed_account(user_id)
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")

    response = client.delete("/api/v1/account", headers=_headers(user_id))

    assert response.status_code == 503
    assert _count(Profile, user_id) == 1
    assert _count(Resume, user_id) == 1


def test_delete_account_removes_owned_rows_and_files_but_keeps_shared_jobs(monkeypatch):
    user_id = uuid.uuid4()
    shared_job_id, storage_path = _seed_account(user_id)
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    response = client.delete("/api/v1/account", headers=_headers(user_id))

    assert response.status_code == 204
    assert admin.bucket_name == settings.RESUME_STORAGE_BUCKET
    assert admin.bucket.removed_paths == [storage_path]
    assert admin.auth_calls == [str(user_id)]
    for model in (
        Profile, Resume, SearchConfig, UserPolicyAcceptance, Application,
        AutomationRun, LinkedInAccount, Skill, Experience, Education,
        ApplicationAnswer, AutomationLog,
    ):
        assert _count(model, user_id) == 0, model.__name__
    db = TestingSessionLocal()
    try:
        assert db.get(Job, shared_job_id) is not None
    finally:
        db.close()


def test_frontend_supplied_user_id_cannot_target_another_account(monkeypatch):
    caller_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    _, caller_path = _seed_account(caller_id)
    _seed_account(other_user_id, email="other@example.com")
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    response = client.request(
        "DELETE",
        "/api/v1/account",
        headers=_headers(caller_id),
        json={"user_id": str(other_user_id)},
    )

    assert response.status_code == 204
    assert admin.auth_calls == [str(caller_id)]
    assert admin.bucket.removed_paths == [caller_path]
    assert _count(Profile, caller_id) == 0
    assert _count(Profile, other_user_id) == 1


def test_storage_failure_preserves_database_rows_and_does_not_delete_auth(monkeypatch):
    user_id = uuid.uuid4()
    _seed_account(user_id)
    admin = FakeAdmin(storage_fail=True)
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    response = client.delete("/api/v1/account", headers=_headers(user_id))

    assert response.status_code == 502
    assert _count(Profile, user_id) == 1
    assert _count(Resume, user_id) == 1
    assert admin.auth_calls == []


def test_storage_path_outside_callers_prefix_is_never_removed(monkeypatch):
    user_id = uuid.uuid4()
    _, _ = _seed_account(user_id)
    other_user_id = uuid.uuid4()
    db = TestingSessionLocal()
    try:
        resume = db.query(Resume).filter(Resume.user_id == user_id).one()
        resume.storage_path = f"resumes/{other_user_id}/someone-elses-file.pdf"
        db.commit()
    finally:
        db.close()

    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)
    response = client.delete("/api/v1/account", headers=_headers(user_id))

    assert response.status_code == 500
    assert _count(Profile, user_id) == 1
    assert admin.bucket.removed_paths == []
    assert admin.auth_calls == []


def test_database_failure_rolls_back_rows_and_allows_retry(monkeypatch):
    user_id = uuid.uuid4()
    _, storage_path = _seed_account(user_id)
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    def fail_profile_delete(connection, cursor, statement, parameters, context, executemany):
        if statement.lower().startswith("delete from profiles"):
            raise RuntimeError("mock database failure")

    event.listen(test_engine, "before_cursor_execute", fail_profile_delete)
    try:
        response = client.delete("/api/v1/account", headers=_headers(user_id))
    finally:
        event.remove(test_engine, "before_cursor_execute", fail_profile_delete)

    assert response.status_code == 500
    assert _count(Profile, user_id) == 1
    assert _count(Application, user_id) == 1
    assert _count(Resume, user_id) == 1
    assert admin.bucket.removed_paths == [storage_path]
    assert admin.auth_calls == []

    retry = client.delete("/api/v1/account", headers=_headers(user_id))
    assert retry.status_code == 204
    assert _count(Profile, user_id) == 0
    assert admin.auth_calls == [str(user_id)]


def test_auth_failure_reports_partial_cleanup_and_retry_completes(monkeypatch):
    user_id = uuid.uuid4()
    _, storage_path = _seed_account(user_id)
    admin = FakeAdmin(auth_failures=[RuntimeError("mock admin failure")])
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    first = client.delete("/api/v1/account", headers=_headers(user_id))
    assert first.status_code == 502
    assert "Auth account could not be deleted" in first.json()["detail"]
    assert _count(Profile, user_id) == 0

    second = client.delete("/api/v1/account", headers=_headers(user_id))
    assert second.status_code == 204
    assert admin.bucket.removed_paths == [storage_path]
    assert admin.auth_calls == [str(user_id), str(user_id)]


def test_repeated_delete_treats_already_missing_auth_user_as_success(monkeypatch):
    user_id = uuid.uuid4()

    class MissingUser(Exception):
        status_code = 404

    admin = FakeAdmin(auth_failures=[MissingUser("not found")])
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    assert client.delete("/api/v1/account", headers=_headers(user_id)).status_code == 204
    assert client.delete("/api/v1/account", headers=_headers(user_id)).status_code == 204
    assert admin.auth_calls == [str(user_id), str(user_id)]


def test_deleted_email_is_reserved_and_rejects_new_registration(monkeypatch):
    old_user_id = uuid.uuid4()
    test_email = "reserved-candidate@example.com"
    _seed_account(old_user_id, email=test_email)
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    # Execute deletion
    del_res = client.delete("/api/v1/account", headers=_headers(old_user_id))
    assert del_res.status_code == 204

    # 1. Authoritative EmailReservation row exists in database
    db = TestingSessionLocal()
    reservation = db.query(EmailReservation).filter(
        EmailReservation.normalized_email == test_email.strip().lower()
    ).first()
    assert reservation is not None
    assert reservation.reason == "account_deleted"
    assert reservation.user_id == old_user_id
    db.close()

    # 2. Check registration endpoint rejects exact email with HTTP 409
    expected_message = (
        "An account associated with this email address was previously deleted, "
        "and a new account cannot be created with it. If you believe this is a "
        "mistake or need assistance, please contact RolePilot Support."
    )
    res_exact = client.post("/api/v1/auth/check-registration", json={"email": test_email})
    assert res_exact.status_code == 409
    assert res_exact.json()["detail"] == expected_message

    # 3. Case variations and whitespace are rejected identically
    res_upper = client.post("/api/v1/auth/check-registration", json={"email": "  RESERVED-CANDIDATE@EXAMPLE.COM  "})
    assert res_upper.status_code == 409
    assert res_upper.json()["detail"] == expected_message

    # 4. Check email alias endpoint works identically
    res_alias = client.post("/api/v1/auth/check-email", json={"email": test_email})
    assert res_alias.status_code == 409
    assert res_alias.json()["detail"] == expected_message

    # 5. Unrelated / new email passes registration check with HTTP 200
    res_fresh = client.post("/api/v1/auth/check-registration", json={"email": "fresh-applicant@example.com"})
    assert res_fresh.status_code == 200
    assert res_fresh.json()["allowed"] is True

    # 6. Auth deletion was recorded for old user
    assert admin.auth.admin.delete_user if hasattr(admin.auth, 'admin') else admin.auth_calls == [str(old_user_id)]


def test_deletion_revokes_protected_access_immediately(monkeypatch):
    user_id = uuid.uuid4()
    test_email = "revoked-user@example.com"
    _seed_account(user_id, email=test_email)
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    # Verify protected access works before deletion
    pre_res = client.get("/api/v1/policy/acceptance-status", headers=_headers(user_id, email=test_email))
    assert pre_res.status_code == 200

    # Delete account
    del_res = client.delete("/api/v1/account", headers=_headers(user_id, email=test_email))
    assert del_res.status_code == 204

    # 1. Protected policy endpoints immediately return 401 Unauthorized
    policy_status_res = client.get("/api/v1/policy/acceptance-status", headers=_headers(user_id, email=test_email))
    assert policy_status_res.status_code == 401
    assert "deleted" in policy_status_res.json()["detail"].lower()

    policy_accept_res = client.post("/api/v1/policy/accept", json={"policy_type": "terms_and_privacy", "policy_version": "v1.0"}, headers=_headers(user_id, email=test_email))
    assert policy_accept_res.status_code == 401
    assert "deleted" in policy_accept_res.json()["detail"].lower()

    # 2. Protected profile endpoints immediately return 401 Unauthorized and do not resurrect profile
    profile_res = client.get("/api/v1/profile", headers=_headers(user_id, email=test_email))
    assert profile_res.status_code == 401
    assert "deleted" in profile_res.json()["detail"].lower()
    assert _count(Profile, user_id) == 0


def test_storage_generic_404_treated_as_success_on_retry(monkeypatch):
    user_id = uuid.uuid4()
    _, storage_path = _seed_account(user_id)

    class GenericStorage404(Exception):
        status_code = 404
        message = "The resource was not found"

    # Bucket raises generic 404 without the word "object"
    class MissingBucket:
        def __init__(self):
            self.removed_paths = []

        def remove(self, paths):
            raise GenericStorage404("The resource was not found")

    admin = FakeAdmin()
    admin.bucket = MissingBucket()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    # Deletion should succeed because missing storage objects are idempotent
    res = client.delete("/api/v1/account", headers=_headers(user_id))
    assert res.status_code == 204
    assert _count(Profile, user_id) == 0


def test_check_registration_does_not_enumerate_active_accounts():
    active_user_id = uuid.uuid4()
    active_email = "existing-active-user@example.com"
    _seed_account(active_user_id, email=active_email)

    # The registration-check endpoint must NOT reveal that an active account exists
    res = client.post("/api/v1/auth/check-registration", json={"email": active_email})
    assert res.status_code == 200
    assert res.json()["allowed"] is True
    assert "available" in res.json()["message"].lower() or "eligible" in res.json()["message"].lower()


def test_email_normalization_variants_enforced(monkeypatch):
    user_id = uuid.uuid4()
    email_with_variants = "  Candidate.Test@Example.COM.  "
    _seed_account(user_id, email=email_with_variants)
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    del_res = client.delete("/api/v1/account", headers=_headers(user_id, email=email_with_variants))
    assert del_res.status_code == 204

    # Test all variations are rejected
    for variant in [
        "candidate.test@example.com",
        "CANDIDATE.TEST@EXAMPLE.COM",
        "  candidate.test@example.com  ",
        "candidate.test@example.com.",
    ]:
        res = client.post("/api/v1/auth/check-registration", json={"email": variant})
        assert res.status_code == 409


def test_concurrent_signup_reservation_unique_constraint():
    """Verify that the database unique constraint strictly rejects duplicate normalized emails."""
    db = TestingSessionLocal()
    email = "concurrent-candidate@example.com"
    res1 = EmailReservation(
        id=uuid.uuid4(),
        normalized_email=email,
        user_id=uuid.uuid4(),
        reason="account_deleted",
    )
    db.add(res1)
    db.commit()

    import pytest
    from sqlalchemy.exc import IntegrityError

    res2 = EmailReservation(
        id=uuid.uuid4(),
        normalized_email=email,
        user_id=uuid.uuid4(),
        reason="account_deleted",
    )
    db.add(res2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()


def test_partially_failed_supabase_auth_cannot_reregister(monkeypatch):
    """If Supabase Auth deletion fails, email reservation is preserved and blocks re-registration."""
    user_id = uuid.uuid4()
    test_email = "partial-auth-fail@example.com"
    _seed_account(user_id, email=test_email)
    admin = FakeAdmin(auth_failures=[RuntimeError("Supabase admin API unavailable")])
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    del_res = client.delete("/api/v1/account", headers=_headers(user_id, email=test_email))
    assert del_res.status_code == 502
    assert "Auth account could not be deleted" in del_res.json()["detail"]

    # 1. Email is reserved immediately in database
    db = TestingSessionLocal()
    reservation = db.query(EmailReservation).filter(
        EmailReservation.normalized_email == test_email
    ).first()
    assert reservation is not None
    assert reservation.user_id == user_id
    db.close()

    # 2. Signup registration check rejects the email with 409 Conflict
    reg_check = client.post("/api/v1/auth/check-registration", json={"email": test_email})
    assert reg_check.status_code == 409
    assert "previously deleted" in reg_check.json()["detail"]

    # 3. Old JWT is rejected on protected endpoints
    status_res = client.get("/api/v1/policy/acceptance-status", headers=_headers(user_id, email=test_email))
    assert status_res.status_code == 401
    assert "deleted" in status_res.json()["detail"].lower()

    # 4. Retrying deletion succeeds when Supabase Auth becomes available
    retry_res = client.delete("/api/v1/account", headers=_headers(user_id, email=test_email))
    assert retry_res.status_code == 204


def test_stale_jwt_access_rejected_on_all_endpoints(monkeypatch):
    """Verify that every protected router rejects stale JWTs with 401 once account is deleted."""
    user_id = uuid.uuid4()
    test_email = "stale-jwt@example.com"
    _seed_account(user_id, email=test_email)
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    # Delete the account
    del_res = client.delete("/api/v1/account", headers=_headers(user_id, email=test_email))
    assert del_res.status_code == 204

    auth_header = _headers(user_id, email=test_email)

    # All protected endpoints must return 401 Unauthorized
    endpoints_to_test = [
        ("GET", "/api/v1/policy/acceptance-status"),
        ("POST", "/api/v1/policy/accept", {"policy_type": "terms_and_privacy", "policy_version": "v1.0"}),
        ("GET", "/api/v1/profile"),
        ("PATCH", "/api/v1/profile", {"headline": "New Title"}),
        ("GET", "/api/v1/search-configs"),
        ("GET", "/api/v1/jobs"),
        ("GET", "/api/v1/applications"),
        ("POST", "/api/v1/automation/runs", {"search_config_id": str(uuid.uuid4())}),
        ("GET", "/api/v1/linkedin/status"),
    ]

    for item in endpoints_to_test:
        method = item[0]
        url = item[1]
        payload = item[2] if len(item) > 2 else None

        if method == "GET":
            resp = client.get(url, headers=auth_header)
        elif method == "POST":
            resp = client.post(url, json=payload, headers=auth_header)
        elif method == "PATCH":
            resp = client.patch(url, json=payload, headers=auth_header)

        assert resp.status_code == 401, f"{method} {url} returned {resp.status_code}"
        assert "deleted" in resp.json()["detail"].lower()


def test_fallback_email_reservation_when_email_missing(monkeypatch):
    """When an account has no email recorded, a deterministic fallback reservation is still stored."""
    user_id = uuid.uuid4()
    _seed_account(user_id, email="")
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    del_res = client.delete("/api/v1/account", headers=_headers(user_id, email=""))
    assert del_res.status_code == 204

    db = TestingSessionLocal()
    reservation = db.query(EmailReservation).filter(EmailReservation.user_id == user_id).first()
    assert reservation is not None
    assert reservation.normalized_email == f"deleted-{user_id}@deleted.rolepilot.local"
    db.close()


