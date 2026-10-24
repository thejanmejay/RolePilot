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


def test_same_email_can_start_fresh_policy_and_onboarding_flow_after_deletion(monkeypatch):
    old_user_id = uuid.uuid4()
    _seed_account(old_user_id, email="reusable@example.com")
    admin = FakeAdmin()
    monkeypatch.setattr("backend.app.services.account_service.get_supabase_admin_client", lambda: admin)

    assert client.delete("/api/v1/account", headers=_headers(old_user_id)).status_code == 204

    # Supabase Auth assigns a new subject after a successful delete and signup.
    new_user_id = uuid.uuid4()
    headers = _headers(new_user_id, email="reusable@example.com")
    accepted = client.post("/api/v1/policy/accept", headers=headers, json={})
    assert accepted.status_code == 200
    status_response = client.get("/api/v1/policy/acceptance-status", headers=headers)
    assert status_response.status_code == 200
    assert status_response.json()["has_accepted"] is True

    onboarding = client.post(
        "/api/v1/profile/onboarding",
        headers=headers,
        json={
            "full_name": "Fresh Candidate",
            "headline": "Software Engineer",
            "target_role": "Backend Engineer",
            "experience_years": 3,
            "city": "Bengaluru",
            "country": "India",
            "phone": "+91 98765 43210",
        },
    )
    assert onboarding.status_code == 200
    assert onboarding.json()["onboarding_completed"] is True
    profile = client.get("/api/v1/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["id"] == str(new_user_id)
    assert _count(Profile, old_user_id) == 0
    assert admin.auth_calls == [str(old_user_id)]
