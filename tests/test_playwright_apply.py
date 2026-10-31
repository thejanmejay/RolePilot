"""Unit and integration tests for Layer 2: Live Playwright Browser Automation and Dry-Run Guard."""

import os
import uuid
from datetime import datetime
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

from linkedin_hunter.auth.session import check_session_health, has_valid_session
from linkedin_hunter.config import HunterConfig, ProfileConfig
from linkedin_hunter.forms.detector import FormField, FieldType
from linkedin_hunter.jobs.apply import (
    execute_single_job_playwright_apply,
    submit_final_application,
    _determine_next_action,
)
from backend.app.workers.linkedin_worker import execute_automation_run


@pytest.mark.asyncio
async def test_session_health_no_cookies(monkeypatch):
    """Test session health check when no cookie file exists."""
    monkeypatch.setattr("linkedin_hunter.auth.session.has_valid_session", lambda cookies=None: False)
    mock_page = AsyncMock()
    health = await check_session_health(mock_page)
    assert health["authenticated"] is False
    assert health["session_available"] is False
    assert "No LinkedIn session" in health["details"]


@pytest.mark.asyncio
async def test_session_health_login_redirect(monkeypatch):
    """Test session health check when redirected to login."""
    monkeypatch.setattr("linkedin_hunter.auth.session.has_valid_session", lambda cookies=None: True)
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/login?fromSignIn=true"
    mock_page.title = AsyncMock(return_value="Sign In | LinkedIn")
    mock_page.query_selector = AsyncMock(return_value=None)

    health = await check_session_health(mock_page)
    assert health["authenticated"] is False
    assert health["session_available"] is True
    assert health["login_redirect"] is True


@pytest.mark.asyncio
async def test_session_health_checkpoint_detected(monkeypatch):
    """Test session health check when security checkpoint is encountered."""
    monkeypatch.setattr("linkedin_hunter.auth.session.has_valid_session", lambda cookies=None: True)
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge/123"
    mock_page.title = AsyncMock(return_value="Security Verification | LinkedIn")
    mock_page.query_selector = AsyncMock(return_value=None)

    health = await check_session_health(mock_page)
    assert health["authenticated"] is False
    assert health["checkpoint_detected"] is True


@pytest.mark.asyncio
async def test_session_health_authenticated(monkeypatch):
    """Test session health check for a valid authenticated session."""
    monkeypatch.setattr("linkedin_hunter.auth.session.has_valid_session", lambda cookies=None: True)
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.title = AsyncMock(return_value="Feed | LinkedIn")
    mock_nav = MagicMock()
    mock_page.query_selector = AsyncMock(side_effect=lambda sel: mock_nav if "nav" in sel else None)

    health = await check_session_health(mock_page)
    assert health["authenticated"] is True
    assert health["login_redirect"] is False
    assert health["checkpoint_detected"] is False


@pytest.mark.asyncio
async def test_determine_next_action():
    """Test determining next action from footer button text/aria."""
    mock_page = AsyncMock()
    mock_btn = AsyncMock()
    mock_page.query_selector_all.return_value = [mock_btn]

    # Submit button
    mock_btn.get_attribute.return_value = "Submit application"
    mock_btn.text_content.return_value = "Submit application"
    assert await _determine_next_action(mock_page) == "submit"

    # Review button
    mock_btn.get_attribute.return_value = "Review your application"
    mock_btn.text_content.return_value = "Review"
    assert await _determine_next_action(mock_page) == "review"

    # Next button
    mock_btn.get_attribute.return_value = "Continue to next step"
    mock_btn.text_content.return_value = "Next"
    assert await _determine_next_action(mock_page) == "next"


@pytest.mark.asyncio
async def test_dry_run_guard_never_submits():
    """CRITICAL: Test that dry_run=True NEVER invokes submit_final_application."""
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"

    # Mock elements
    mock_easy_apply_btn = AsyncMock()
    mock_easy_apply_btn.is_visible.return_value = True
    mock_easy_apply_btn.get_attribute.return_value = "Easy Apply"
    mock_easy_apply_btn.text_content.return_value = "Easy Apply"

    mock_modal = AsyncMock()
    mock_modal.text_content.return_value = ""
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
    mock_page.query_selector_all.return_value = [mock_easy_apply_btn, mock_footer_btn]

    logged_events = []
    def log_cb(evt, msg, lvl, meta):
        logged_events.append((evt, msg, lvl, meta))

    config = HunterConfig(profile=ProfileConfig(first_name="Jane", last_name="Doe", phone="1234567890"))

    with patch("linkedin_hunter.jobs.apply.submit_final_application", new_callable=AsyncMock) as mock_submit:
        with patch("linkedin_hunter.jobs.apply.detect_form_fields", new_callable=AsyncMock) as mock_detect:
            mock_detect.return_value = []
            with patch("linkedin_hunter.jobs.apply._click_easy_apply", new_callable=AsyncMock) as mock_click:
                mock_click.return_value = True
                with patch("linkedin_hunter.jobs.apply._is_already_applied_on_page", new_callable=AsyncMock) as mock_applied:
                    mock_applied.return_value = False
                    with patch("linkedin_hunter.jobs.apply._scrape_modal_profile", new_callable=AsyncMock):

                        res = await execute_single_job_playwright_apply(
                            page=mock_page,
                            config=config,
                            job_url="https://www.linkedin.com/jobs/view/123456",
                            job_id="test-job-123",
                            job_title="Senior QA Engineer",
                            dry_run=True,
                            log_event_cb=log_cb,
                        )

                        # Assert submit_final_application was NEVER called
                        mock_submit.assert_not_called()

                        # Assert dry-run telemetry
                        assert res["success"] is True
                        assert res["dry_run"] is True
                        assert res["submission_blocked"] is True
                        assert res["review_reached"] is True

                        # Assert DRY_RUN_SUBMIT_BLOCKED event was logged
                        event_names = [e[0] for e in logged_events]
                        assert "DRY_RUN_SUBMIT_BLOCKED" in event_names
                        assert "APPLICATION_MODAL_DISCARDED" in event_names
                        assert "DRY_RUN_COMPLETED" in event_names


@pytest.mark.asyncio
async def test_live_mode_calls_submit_when_triple_key_confirmed():
    """Test that dry_run=False with Triple-Key confirmation calls submit_final_application and verifies post-submit."""
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"

    mock_easy_apply_btn = AsyncMock()
    mock_easy_apply_btn.is_visible.return_value = True
    mock_easy_apply_btn.get_attribute.return_value = "Easy Apply"
    mock_easy_apply_btn.text_content.return_value = "Easy Apply"

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
    mock_page.query_selector_all.return_value = [mock_easy_apply_btn, mock_footer_btn]

    config = HunterConfig()

    with patch("linkedin_hunter.jobs.apply.submit_final_application", new_callable=AsyncMock) as mock_submit:
        with patch("linkedin_hunter.jobs.apply.verify_post_submit_status", new_callable=AsyncMock) as mock_verify:
            mock_verify.return_value = {
                "status": "confirmed",
                "details": "Application sent successfully",
                "error_message": None,
                "captcha_detected": False,
                "checkpoint_detected": False,
            }
            with patch("linkedin_hunter.jobs.apply.detect_form_fields", new_callable=AsyncMock) as mock_detect:
                mock_detect.return_value = []
                with patch("linkedin_hunter.jobs.apply._click_easy_apply", new_callable=AsyncMock) as mock_click:
                    mock_click.return_value = True
                    with patch("linkedin_hunter.jobs.apply._is_already_applied_on_page", new_callable=AsyncMock) as mock_applied:
                        mock_applied.return_value = False
                        with patch("linkedin_hunter.jobs.apply._scrape_modal_profile", new_callable=AsyncMock):

                            res = await execute_single_job_playwright_apply(
                                page=mock_page,
                                config=config,
                                job_url="https://www.linkedin.com/jobs/view/123456",
                                job_id="test-job-123",
                                job_title="Senior QA Engineer",
                                dry_run=False,
                                allow_live_submission=True,
                                live_submission_confirmation="CONFIRM_REAL_SUBMISSION",
                            )

                            # Live mode must call submit_final_application and verify
                            mock_submit.assert_called_once()
                            mock_verify.assert_called_once()
                            assert res["success"] is True
                            assert res["dry_run"] is False
                            assert res["submission_attempted"] is True
                            assert res["submission_confirmed"] is True
                            assert res["submission_blocked"] is False


@pytest.mark.asyncio
async def test_live_mode_blocked_without_confirmation_token():
    """Test that dry_run=False without matching confirmation token is safely blocked."""
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"

    mock_easy_apply_btn = AsyncMock()
    mock_easy_apply_btn.is_visible.return_value = True
    mock_easy_apply_btn.get_attribute.return_value = "Easy Apply"
    mock_easy_apply_btn.text_content.return_value = "Easy Apply"

    mock_modal = AsyncMock()
    mock_modal.text_content.return_value = ""
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
    mock_page.query_selector_all.return_value = [mock_easy_apply_btn, mock_footer_btn]

    config = HunterConfig()

    with patch("linkedin_hunter.jobs.apply.submit_final_application", new_callable=AsyncMock) as mock_submit:
        with patch("linkedin_hunter.jobs.apply.detect_form_fields", new_callable=AsyncMock) as mock_detect:
            mock_detect.return_value = []
            with patch("linkedin_hunter.jobs.apply._click_easy_apply", new_callable=AsyncMock) as mock_click:
                mock_click.return_value = True
                with patch("linkedin_hunter.jobs.apply._is_already_applied_on_page", new_callable=AsyncMock) as mock_applied:
                    mock_applied.return_value = False
                    with patch("linkedin_hunter.jobs.apply._scrape_modal_profile", new_callable=AsyncMock):

                        # Passing allow_live_submission=True BUT missing token
                        res = await execute_single_job_playwright_apply(
                            page=mock_page,
                            config=config,
                            job_url="https://www.linkedin.com/jobs/view/123456",
                            job_id="test-job-123",
                            job_title="Senior QA Engineer",
                            dry_run=False,
                            allow_live_submission=True,
                            live_submission_confirmation=None,
                        )

                        # Must NOT submit
                        mock_submit.assert_not_called()
                        assert res["submission_blocked"] is True
                        assert res["submission_confirmed"] is False


@pytest.mark.asyncio
async def test_easy_apply_not_available():
    """Test handling when Easy Apply button is absent."""
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"
    mock_page.query_selector_all.return_value = []

    logged_events = []
    def log_cb(evt, msg, lvl, meta):
        logged_events.append((evt, msg, lvl, meta))

    config = HunterConfig()

    with patch("linkedin_hunter.jobs.apply._is_already_applied_on_page", new_callable=AsyncMock) as mock_applied:
        mock_applied.return_value = False

        res = await execute_single_job_playwright_apply(
            page=mock_page,
            config=config,
            job_url="https://www.linkedin.com/jobs/view/123456",
            job_id="test-job-123",
            job_title="Senior QA Engineer",
            dry_run=True,
            log_event_cb=log_cb,
        )

        assert res["easy_apply_detected"] is False
        assert res.get("skipped") is True
        assert any(e[0] == "EASY_APPLY_NOT_AVAILABLE" for e in logged_events)


@pytest.mark.asyncio
async def test_resume_upload_and_field_filling_telemetry(tmp_path):
    """Test telemetry emission for resume upload and field detection."""
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"

    mock_easy_apply_btn = AsyncMock()
    mock_easy_apply_btn.is_visible.return_value = True
    mock_easy_apply_btn.get_attribute.return_value = "Easy Apply"
    mock_easy_apply_btn.text_content.return_value = "Easy Apply"

    mock_modal = AsyncMock()
    mock_modal.text_content.return_value = ""
    mock_footer_btn = AsyncMock()
    mock_footer_btn.get_attribute.return_value = "Submit application"
    mock_footer_btn.text_content.return_value = "Submit application"

    async def mock_query_sel(sel):
        if "button" in sel or "primary" in sel or "next" in sel:
            return mock_footer_btn
        if "modal" in sel or "easy-apply" in sel:
            return mock_modal
        return None

    mock_page.query_selector.side_effect = mock_query_sel
    mock_page.query_selector_all.return_value = [mock_easy_apply_btn, mock_footer_btn]

    # Create dummy resume file
    resume_file = tmp_path / "my_resume.pdf"
    resume_file.write_text("Dummy resume")

    mock_file_el = AsyncMock()
    mock_text_el = AsyncMock()

    fields = [
        FormField(field_type=FieldType.FILE_UPLOAD, label="Resume", element=mock_file_el, required=True),
        FormField(field_type=FieldType.TEXT, label="How many years of Java experience?", element=mock_text_el, required=True),
    ]

    logged_events = []
    def log_cb(evt, msg, lvl, meta):
        logged_events.append((evt, msg, lvl, meta))

    config = HunterConfig(profile=ProfileConfig(first_name="Jane", last_name="Doe", years_of_experience=5))

    with patch("linkedin_hunter.jobs.apply._is_already_applied_on_page", new_callable=AsyncMock) as mock_applied:
        mock_applied.return_value = False
        with patch("linkedin_hunter.jobs.apply._click_easy_apply", new_callable=AsyncMock) as mock_click:
            mock_click.return_value = True
            with patch("linkedin_hunter.jobs.apply.detect_form_fields", new_callable=AsyncMock) as mock_detect:
                mock_detect.return_value = fields
                with patch("linkedin_hunter.forms.filler._fill_field", new_callable=AsyncMock) as mock_fill:
                    mock_fill.return_value = True
                    with patch("linkedin_hunter.jobs.apply._scrape_modal_profile", new_callable=AsyncMock):

                        res = await execute_single_job_playwright_apply(
                            page=mock_page,
                            config=config,
                            job_url="https://www.linkedin.com/jobs/view/123456",
                            job_id="test-job-123",
                            job_title="Senior QA Engineer",
                            dry_run=True,
                            resume_path=str(resume_file),
                            log_event_cb=log_cb,
                        )

                        assert res["resume_uploaded"] is True
                        assert res["fields_detected"] == 2
                        assert res["submission_blocked"] is True

                        event_types = [e[0] for e in logged_events]
                        assert "RESUME_UPLOAD_STARTED" in event_types
                        assert "RESUME_UPLOAD_COMPLETED" in event_types
                        assert "QUESTION_DETECTED" in event_types
                        assert "QUESTION_ANSWERED" in event_types
                        assert "DRY_RUN_SUBMIT_BLOCKED" in event_types


@pytest.mark.asyncio
async def test_invalid_session_fails_run_immediately():
    """Test that invalid session prevents job execution and fails run truthfully without applied records."""
    mock_db = MagicMock()
    mock_run = MagicMock()
    mock_run.id = uuid.uuid4()
    mock_run.user_id = uuid.uuid4()
    mock_run.status = "queued"
    mock_run.search_config = None
    mock_run.search_overrides = None
    mock_run.selected_synced_job_ids = None
    mock_run.applications_submitted = 0

    mock_profile = MagicMock()
    mock_profile.first_name = "Jane"
    mock_profile.last_name = "Doe"
    mock_profile.email = "jane@example.com"
    mock_profile.phone = "1234567890"
    mock_profile.city = "New York"
    mock_profile.state = "NY"
    mock_profile.country = "USA"
    mock_profile.linkedin_url = ""
    mock_profile.github_url = ""
    mock_profile.website_url = ""
    mock_profile.experience_years = 2
    mock_profile.experience_months = 0
    mock_profile.notice_period_days = 30
    mock_profile.skills = []
    mock_profile.experiences = []
    mock_profile.current_ctc = 0
    mock_profile.expected_ctc = 0
    mock_profile.authorized_to_work = True
    mock_profile.willing_to_relocate = True

    mock_consent = MagicMock()
    mock_consent.user_id = mock_run.user_id
    mock_consent.policy_type = "linkedin_automation"

    def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "automation_runs" in stmt_str:
            res.scalar_one_or_none.return_value = mock_run
            res.scalars.return_value.first.return_value = mock_run
        elif "profiles" in stmt_str:
            res.scalar_one_or_none.return_value = mock_profile
            res.scalars.return_value.first.return_value = mock_profile
        elif "user_policy_acceptance" in stmt_str:
            res.scalars.return_value.first.return_value = mock_consent
            res.scalar_one_or_none.return_value = mock_consent
        elif "linkedin_accounts" in stmt_str:
            res.scalar_one_or_none.return_value = None
            res.scalars.return_value.first.return_value = None
        elif "resumes" in stmt_str:
            res.scalars.return_value.first.return_value = None
            res.scalar_one_or_none.return_value = None
        elif "jobs" in stmt_str:
            res.scalars.return_value.all.return_value = []
            res.scalars.return_value.first.return_value = None
        else:
            res.scalar_one_or_none.return_value = None
            res.scalars.return_value.first.return_value = None
            res.scalars.return_value.all.return_value = []
        return res

    mock_db.execute.side_effect = mock_execute

    with patch("backend.app.workers.linkedin_worker.SessionLocal", return_value=mock_db):
        with patch("backend.app.services.linkedin_session_validator.LinkedInSessionValidator.validate_session", new_callable=AsyncMock) as mock_validate:
            mock_validate.return_value = MagicMock(is_valid=False, error_code="LINKEDIN_SESSION_INVALID", error_title="LinkedIn session expired", error_message="LinkedIn session authentication failed: session expired")
            with patch("backend.app.services.browser_diagnostics.verify_browser_runtime", return_value={"available": True}):
                with patch("linkedin_hunter.auth.session.load_cookies", return_value=None):
                    with patch("linkedin_hunter.auth.session.has_valid_session", return_value=False):
                        with patch("backend.app.services.automation_service.AutomationService.log_event") as mock_log:
                            await execute_automation_run(mock_run.id, mock_run.user_id, dry_run=True, max_jobs=1)

                # Status must be failed
                assert mock_run.status == "failed"
                assert "authentication failed" in mock_run.error_message
                assert mock_run.applications_submitted == 0

                # Verify LINKEDIN_SESSION_INVALID and RUN_FAILED logged
                logged_events = [c[1]["event"] for c in mock_log.call_args_list]
                assert "LINKEDIN_SESSION_INVALID" in logged_events
                assert "RUN_FAILED" in logged_events
                assert "APPLICATION_SUBMITTED" not in logged_events


def test_real_linkedin_job_url_validation():
    """Test validation of real vs synthetic/test job URLs."""
    from backend.app.workers.linkedin_worker import is_valid_real_linkedin_job_url

    assert is_valid_real_linkedin_job_url("https://www.linkedin.com/jobs/view/4462936722/") is True
    assert is_valid_real_linkedin_job_url("https://www.linkedin.com/jobs/view/1234567890?refId=abc") is True
    assert is_valid_real_linkedin_job_url("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4462936722") is True

    # Synthetic / invalid URLs must be rejected
    assert is_valid_real_linkedin_job_url("https://www.linkedin.com/jobs/view/test-job-101") is False
    assert is_valid_real_linkedin_job_url("https://example.com/job/123") is False
    assert is_valid_real_linkedin_job_url("http://localhost:8000/jobs/1") is False
    assert is_valid_real_linkedin_job_url("https://www.linkedin.com/jobs/view/mock-job-55") is False
    assert is_valid_real_linkedin_job_url("https://linkedin.com.evil.test/jobs/view/1234567890") is False
    assert is_valid_real_linkedin_job_url("https://www.linkedin.com.evil.test/jobs/view/1234567890") is False
    assert is_valid_real_linkedin_job_url("http://www.linkedin.com/jobs/view/1234567890") is False
    assert is_valid_real_linkedin_job_url("https://user@www.linkedin.com/jobs/view/1234567890") is False
    assert is_valid_real_linkedin_job_url("https://www.linkedin.com:444/jobs/view/1234567890") is False
    assert is_valid_real_linkedin_job_url("") is False
    assert is_valid_real_linkedin_job_url(None) is False


@pytest.mark.asyncio
async def test_dry_run_application_state_semantics():
    """Test that dry run records application as dry_run_blocked and leaves applications_submitted at 0."""
    from backend.app.workers.linkedin_worker import execute_automation_run

    mock_db = MagicMock()
    mock_run = MagicMock()
    mock_run.id = uuid.uuid4()
    mock_run.user_id = uuid.uuid4()
    mock_run.status = "queued"
    mock_run.search_config = None
    mock_run.search_overrides = None
    mock_run.selected_synced_job_ids = None
    mock_run.jobs_found = 0
    mock_run.jobs_processed = 0
    mock_run.applications_submitted = 0
    mock_run.applications_skipped = 0
    mock_run.applications_failed = 0

    mock_profile = MagicMock()
    mock_profile.id = mock_run.user_id
    mock_profile.first_name = "Jane"
    mock_profile.last_name = "Doe"
    mock_profile.email = "jane@example.com"
    mock_profile.phone = "1234567890"
    mock_profile.city = "New York"
    mock_profile.state = "NY"
    mock_profile.country = "USA"
    mock_profile.linkedin_url = "https://linkedin.com/in/jane"
    mock_profile.github_url = "https://github.com/jane"
    mock_profile.website_url = "https://jane.dev"
    mock_profile.skills = []
    mock_profile.experiences = []
    mock_profile.experience_years = 3
    mock_profile.experience_months = 0
    mock_profile.notice_period_days = 30
    mock_profile.current_ctc = 0
    mock_profile.expected_ctc = 0
    mock_profile.authorized_to_work = True
    mock_profile.willing_to_relocate = True

    mock_job = MagicMock()
    mock_job.id = uuid.uuid4()
    mock_job.title = "QA Engineer"
    mock_job.company = "Tech Corp"
    mock_job.location = "Remote"
    mock_job.job_url = "https://www.linkedin.com/jobs/view/4462936722/"
    mock_job.description = "QA Automation Engineer role"

    mock_run.worker_id = "default"
    mock_consent = MagicMock()
    mock_consent.user_id = mock_run.user_id
    mock_consent.policy_type = "linkedin_automation"

    def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "automation_runs" in stmt_str:
            res.scalar_one_or_none.return_value = mock_run
            res.scalars.return_value.first.return_value = mock_run
        elif "profiles" in stmt_str:
            res.scalar_one_or_none.return_value = mock_profile
            res.scalars.return_value.first.return_value = mock_profile
        elif "user_policy_acceptance" in stmt_str:
            res.scalars.return_value.first.return_value = mock_consent
            res.scalar_one_or_none.return_value = mock_consent
        elif "linkedin_accounts" in stmt_str:
            res.scalar_one_or_none.return_value = None
            res.scalars.return_value.first.return_value = None
        elif "resumes" in stmt_str:
            res.scalars.return_value.first.return_value = None
            res.scalar_one_or_none.return_value = None
        elif "jobs" in stmt_str:
            res.scalars.return_value.all.return_value = [mock_job]
            res.scalars.return_value.first.return_value = mock_job
        else:
            res.scalar_one_or_none.return_value = None
            res.scalars.return_value.first.return_value = None
            res.scalars.return_value.all.return_value = []
        return res

    mock_db.execute.side_effect = mock_execute

    playwright_return = {
        "success": True,
        "dry_run": True,
        "submission_blocked": True,
        "review_reached": True,
        "steps_completed": 3,
        "fields_filled": 4,
    }

    with patch("backend.app.workers.linkedin_worker.SessionLocal", return_value=mock_db):
        with patch("backend.app.services.linkedin_session_validator.LinkedInSessionValidator.validate_session", new_callable=AsyncMock) as mock_validate:
            mock_validate.return_value = MagicMock(is_valid=True, cookies=[{"name": "li_at", "value": "mock-cookie"}])
            with patch("backend.app.services.browser_diagnostics.verify_browser_runtime", return_value={"available": True}):
                with patch("linkedin_hunter.auth.session.has_valid_session", return_value=True):
                    with patch("linkedin_hunter.auth.session.load_cookies", return_value=[{"name": "li_at", "value": "mock-cookie"}]):
                        with patch("linkedin_hunter.auth.session.check_session_health", new_callable=AsyncMock) as mock_health:
                            mock_health.return_value = {"authenticated": True, "details": "Verified"}
                            with patch("linkedin_hunter.browser.engine.BrowserEngine.launch", new_callable=AsyncMock) as mock_launch:
                                mock_launch.return_value = AsyncMock()
                                with patch("linkedin_hunter.browser.engine.BrowserEngine.load_cookies", new_callable=AsyncMock):
                                    with patch("linkedin_hunter.browser.engine.BrowserEngine.close", new_callable=AsyncMock) as mock_close:
                                        with patch("linkedin_hunter.jobs.apply.execute_single_job_playwright_apply", new_callable=AsyncMock) as mock_apply:
                                            mock_apply.return_value = playwright_return
                                            with patch("backend.app.services.application_service.ApplicationService.record_application") as mock_record_app:
                                                mock_app_rec = MagicMock()
                                                mock_app_rec.id = uuid.uuid4()
                                                mock_app_rec.attempt_count = 0
                                                mock_record_app.return_value = mock_app_rec

                                                await execute_automation_run(mock_run.id, mock_run.user_id, dry_run=True, max_jobs=1)

                                                # Verify applications_submitted is strictly 0
                                                assert mock_run.applications_submitted == 0
                                                assert mock_run.jobs_processed == 1
                                                assert mock_run.status == "completed"

                                                # Verify Application record was created with status="dry_run_blocked"
                                                assert mock_record_app.call_count == 2
                                                assert mock_record_app.call_args_list[-1][1]["status"] == "dry_run_blocked"

                                                # Verify browser engine closed
                                                mock_close.assert_called_once()


@pytest.mark.asyncio
async def test_post_submit_verification_success():
    """Test verify_post_submit_status detects success confirmation modal."""
    from linkedin_hunter.jobs.apply import verify_post_submit_status

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"

    mock_success_modal = AsyncMock()
    mock_success_modal.is_visible.return_value = True

    async def mock_query_sel(sel):
        if "post-apply" in sel or "Application sent" in sel:
            return mock_success_modal
        return None

    mock_page.query_selector.side_effect = mock_query_sel
    mock_page.query_selector_all.return_value = []

    res = await verify_post_submit_status(mock_page, timeout_sec=1.0)
    assert res["status"] == "confirmed"
    assert "successfully submitted" in res["details"].lower()


@pytest.mark.asyncio
async def test_post_submit_verification_validation_error():
    """Test verify_post_submit_status detects form validation errors post-submit."""
    from linkedin_hunter.jobs.apply import verify_post_submit_status

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"

    mock_error_el = AsyncMock()
    mock_error_el.is_visible.return_value = True
    mock_error_el.text_content.return_value = "Please enter a valid phone number"

    mock_page.query_selector.return_value = None
    mock_page.query_selector_all.return_value = [mock_error_el]

    res = await verify_post_submit_status(mock_page, timeout_sec=1.0)
    assert res["status"] == "failed"
    assert "Please enter a valid phone number" in res["error_message"]


@pytest.mark.asyncio
async def test_post_submit_verification_security_challenge_or_captcha():
    """Test verify_post_submit_status detects checkpoint or captcha."""
    from linkedin_hunter.jobs.apply import verify_post_submit_status

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge/12345"

    res = await verify_post_submit_status(mock_page, timeout_sec=1.0)
    assert res["status"] == "failed"
    assert res["checkpoint_detected"] is True
    assert "checkpoint" in res["error_message"].lower()


@pytest.mark.asyncio
async def test_post_submit_verification_ambiguous_state():
    """Test verify_post_submit_status returns ambiguous when timeout expires with modal open."""
    from linkedin_hunter.jobs.apply import verify_post_submit_status

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/jobs/view/123456"

    mock_modal = AsyncMock()
    mock_modal.is_visible.return_value = True

    async def mock_query_sel(sel):
        if "has-text" in sel or "Applied" in sel or "post-apply" in sel:
            return None
        if "jobs-easy-apply" in sel or "artdeco-modal" in sel:
            return mock_modal
        return None

    mock_page.query_selector.side_effect = mock_query_sel
    mock_page.query_selector_all.return_value = []

    res = await verify_post_submit_status(mock_page, timeout_sec=0.5)
    assert res["status"] == "ambiguous"
    assert "not conclusively confirmed" in res["error_message"]


def test_profile_derived_answers_mapping():
    """Verify that build_hunter_config correctly derives all profile fields for form answering."""
    from backend.app.workers.linkedin_worker import build_hunter_config

    mock_profile = MagicMock()
    mock_profile.first_name = "Janmejay"
    mock_profile.last_name = "Singh"
    mock_profile.email = "test@example.com"
    mock_profile.phone = "9123159508"
    mock_profile.city = "Noida"
    mock_profile.state = "UP"
    mock_profile.country = "India"
    mock_profile.experience_years = 4
    mock_profile.experience_months = 6
    mock_profile.notice_period_days = 15
    mock_profile.current_ctc = 1200000
    mock_profile.expected_ctc = 1800000
    mock_profile.authorized_to_work = True
    mock_profile.willing_to_relocate = True
    mock_profile.skills = []
    mock_profile.linkedin_url = "https://linkedin.com/in/janmejay"
    mock_profile.github_url = ""
    mock_profile.website_url = ""

    cfg = build_hunter_config(
        profile=mock_profile,
        active_resume=None,
        search_cfg=None,
        dry_run=True,
        max_jobs=10,
        allow_live_submission=False,
    )

    assert cfg.profile.first_name == "Janmejay"
    assert cfg.profile.years_of_experience == 4
    assert cfg.profile.months_of_experience == 6
    assert cfg.profile.notice_period_days == 15
    assert cfg.profile.city == "Noida"
    assert cfg.answers.current_salary == "1200000"
    assert cfg.answers.desired_salary == "1800000"
    assert cfg.answers.authorized_to_work is True
    assert cfg.answers.willing_to_relocate is True
    assert cfg.apply.allow_live_submission is False


def test_max_jobs_enforced_to_one_for_live_mode():
    """Verify that build_hunter_config strictly caps max_jobs to 1 when live submission is enabled."""
    from backend.app.workers.linkedin_worker import build_hunter_config

    mock_profile = MagicMock()
    mock_profile.first_name = "Janmejay"
    mock_profile.last_name = "Singh"
    mock_profile.email = "test@example.com"
    mock_profile.phone = "9123159508"
    mock_profile.city = "Noida"
    mock_profile.state = "UP"
    mock_profile.country = "India"
    mock_profile.experience_years = 4
    mock_profile.experience_months = 6
    mock_profile.notice_period_days = 15
    mock_profile.current_ctc = 1200000
    mock_profile.expected_ctc = 1800000
    mock_profile.authorized_to_work = True
    mock_profile.willing_to_relocate = True
    mock_profile.skills = []
    mock_profile.linkedin_url = ""
    mock_profile.github_url = ""
    mock_profile.website_url = ""

    cfg = build_hunter_config(
        profile=mock_profile,
        active_resume=None,
        search_cfg=None,
        dry_run=False,
        max_jobs=50,  # User requested 50
        allow_live_submission=True,  # Live submission enabled
    )

    # Must be strictly clamped to 1
    assert cfg.search.max_jobs == 1


@pytest.mark.asyncio
async def test_ambiguous_submission_does_not_increment_counter_or_retry():
    """Verify that an ambiguous submission result is recorded as failed without retry or counter increment."""
    from backend.app.workers.linkedin_worker import execute_automation_run

    mock_db = MagicMock()
    mock_run = MagicMock()
    mock_run.id = uuid.uuid4()
    mock_run.user_id = uuid.uuid4()
    mock_run.status = "queued"
    mock_run.search_config = None
    mock_run.search_overrides = None
    mock_run.selected_synced_job_ids = None
    mock_run.jobs_found = 0
    mock_run.jobs_processed = 0
    mock_run.applications_submitted = 0
    mock_run.applications_skipped = 0
    mock_run.applications_failed = 0

    mock_profile = MagicMock()
    mock_profile.id = mock_run.user_id
    mock_profile.first_name = "Jane"
    mock_profile.last_name = "Doe"
    mock_profile.email = "jane@example.com"
    mock_profile.phone = "1234567890"
    mock_profile.city = "New York"
    mock_profile.state = "NY"
    mock_profile.country = "USA"
    mock_profile.linkedin_url = "https://linkedin.com/in/jane"
    mock_profile.github_url = ""
    mock_profile.website_url = ""
    mock_profile.skills = []
    mock_profile.experiences = []
    mock_profile.experience_years = 3
    mock_profile.experience_months = 0
    mock_profile.notice_period_days = 30
    mock_profile.current_ctc = 0
    mock_profile.expected_ctc = 0
    mock_profile.authorized_to_work = True
    mock_profile.willing_to_relocate = True

    mock_job = MagicMock()
    mock_job.id = uuid.uuid4()
    mock_job.title = "QA Engineer"
    mock_job.company = "Tech Corp"
    mock_job.location = "Remote"
    mock_job.job_url = "https://www.linkedin.com/jobs/view/4462936722/"
    mock_job.description = "QA role"

    mock_run.worker_id = "default"
    mock_consent = MagicMock()
    mock_consent.user_id = mock_run.user_id
    mock_consent.policy_type = "linkedin_automation"

    def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "automation_runs" in stmt_str:
            res.scalar_one_or_none.return_value = mock_run
            res.scalars.return_value.first.return_value = mock_run
        elif "profiles" in stmt_str:
            res.scalar_one_or_none.return_value = mock_profile
            res.scalars.return_value.first.return_value = mock_profile
        elif "user_policy_acceptance" in stmt_str:
            res.scalars.return_value.first.return_value = mock_consent
            res.scalar_one_or_none.return_value = mock_consent
        elif "linkedin_accounts" in stmt_str:
            res.scalar_one_or_none.return_value = None
            res.scalars.return_value.first.return_value = None
        elif "resumes" in stmt_str:
            res.scalars.return_value.first.return_value = None
            res.scalar_one_or_none.return_value = None
        elif "jobs" in stmt_str:
            res.scalars.return_value.all.return_value = [mock_job]
            res.scalars.return_value.first.return_value = mock_job
        else:
            res.scalar_one_or_none.return_value = None
            res.scalars.return_value.first.return_value = None
            res.scalars.return_value.all.return_value = []
        return res

    mock_db.execute.side_effect = mock_execute

    ambiguous_return = {
        "success": False,
        "dry_run": False,
        "submission_attempted": True,
        "submission_confirmed": False,
        "submission_blocked": False,
        "error_message": "Post-submission state was not conclusively confirmed within timeout",
    }

    with patch("backend.app.workers.linkedin_worker.SessionLocal", return_value=mock_db):
        with patch("backend.app.services.linkedin_session_validator.LinkedInSessionValidator.validate_session", new_callable=AsyncMock) as mock_validate:
            mock_validate.return_value = MagicMock(is_valid=True, cookies=[{"name": "li_at", "value": "mock-cookie"}])
            with patch("backend.app.services.browser_diagnostics.verify_browser_runtime", return_value={"available": True}):
                with patch("linkedin_hunter.auth.session.has_valid_session", return_value=True):
                    with patch("linkedin_hunter.auth.session.load_cookies", return_value=[{"name": "li_at", "value": "mock-cookie"}]):
                        with patch("linkedin_hunter.auth.session.check_session_health", new_callable=AsyncMock) as mock_health:
                            mock_health.return_value = {"authenticated": True, "details": "Verified"}
                            with patch("linkedin_hunter.browser.engine.BrowserEngine.launch", new_callable=AsyncMock) as mock_launch:
                                mock_launch.return_value = AsyncMock()
                                with patch("linkedin_hunter.browser.engine.BrowserEngine.load_cookies", new_callable=AsyncMock):
                                    with patch("linkedin_hunter.browser.engine.BrowserEngine.close", new_callable=AsyncMock) as mock_close:
                                        with patch("linkedin_hunter.jobs.apply.execute_single_job_playwright_apply", new_callable=AsyncMock) as mock_apply:
                                            mock_apply.return_value = ambiguous_return
                                            with patch("backend.app.services.application_service.ApplicationService.record_application") as mock_record_app:
                                                mock_app_rec = MagicMock()
                                                mock_app_rec.id = uuid.uuid4()
                                                mock_app_rec.attempt_count = 0
                                                mock_record_app.return_value = mock_app_rec

                                                await execute_automation_run(
                                                    mock_run.id,
                                                    mock_run.user_id,
                                                    dry_run=False,
                                                    max_jobs=1,
                                                    allow_live_submission=True,
                                                    live_submission_confirmation="CONFIRM_REAL_SUBMISSION",
                                                )

                                                # applications_submitted must remain strictly 0
                                                assert mock_run.applications_submitted == 0
                                                assert mock_run.applications_failed == 1
                                                assert mock_record_app.call_args[1]["status"] == "needs_verification"
                                                mock_close.assert_called_once()



