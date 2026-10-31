"""LinkedIn Automation Worker.

Orchestrates background automation runs by loading user profile, active resume,
skills, and search configurations from the database and driving the existing
linkedin_hunter domain engine.
"""

import asyncio
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlsplit

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from backend.app.core.config import settings
from backend.app.db.database import SessionLocal
from backend.app.db.models.application import Application
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.job import Job
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.search_config import SearchConfig
from backend.app.db.models.synced_job import SyncedJob
from backend.app.services.application_service import ApplicationService
from backend.app.services.automation_service import AutomationService
from backend.app.services.job_service import JobService
from backend.app.services.notification_service import NotificationService
from linkedin_hunter.config import (
    AnswersConfig,
    ApplyConfig,
    BrowserConfig,
    CustomAnswer,
    HunterConfig,
    ProfileConfig,
    SearchConfig as DomainSearchConfig,
)

logger = logging.getLogger(__name__)

FRESHNESS_WINDOW_DAYS = 30


def _close_pending_run_applications(db: Session, run_id: uuid.UUID, final_status: str, message: str) -> None:
    pending = db.execute(select(Application).where(
        Application.run_id == run_id,
        Application.status == "pending",
    )).scalars().all()
    for application in pending:
        application.status = final_status
        application.error_message = message
    if pending:
        db.commit()


def extract_canonical_job_identity(url: str, raw_job_id: Optional[str] = None) -> tuple[str, str]:
    """Extract (canonical_job_id, canonical_url) from a LinkedIn job link, stripping tracking parameters."""
    job_id = (raw_job_id or "").strip()
    clean_url = (url or "").strip()

    if not job_id or not job_id.isdigit():
        m = re.search(r"/jobs/view/(\d+)", clean_url) or re.search(r"currentJobId=(\d+)", clean_url)
        if m:
            job_id = m.group(1)
        elif job_id and re.search(r"(\d{5,})", job_id):
            job_id = re.search(r"(\d{5,})", job_id).group(1)

    if job_id and job_id.isdigit():
        canonical_url = f"https://www.linkedin.com/jobs/view/{job_id}/"
        return job_id, canonical_url

    clean_path = clean_url.split("?")[0].rstrip("/") + "/"
    canonical_id = job_id or str(abs(hash(clean_path)))[:12]
    return canonical_id, clean_path


def select_eligible_unapplied_jobs(
    db: Session,
    user_id: uuid.UUID,
    keywords_str: str,
    location_str: str,
    limit_val: int = 10,
    freshness_days: int = FRESHNESS_WINDOW_DAYS,
) -> List[Job]:
    """Select unapplied, non-expired, fresh jobs matching user criteria."""
    now = datetime.now(timezone.utc)
    freshness_cutoff = now - timedelta(days=freshness_days)

    applied_subquery = (
        select(Application.job_id)
        .where(
            Application.user_id == user_id,
            Application.status.in_(["applied", "submitted", "already_applied"]),
        )
    )

    query_words = [w.strip() for w in keywords_str.replace(",", " ").split() if len(w.strip()) > 1]

    stmt = (
        select(Job)
        .where(
            Job.id.notin_(applied_subquery),
            Job.created_at >= freshness_cutoff,
        )
    )

    if query_words:
        word_filters = []
        for w in query_words:
            word_filters.append(Job.title.ilike(f"%{w}%"))
            word_filters.append(Job.description.ilike(f"%{w}%"))
        stmt = stmt.where(or_(*word_filters))

    if location_str and location_str.lower() not in ["any", "all", "worldwide"]:
        stmt = stmt.where(Job.location.ilike(f"%{location_str}%"))

    stmt = stmt.order_by(Job.created_at.desc()).limit(limit_val)
    jobs = list(db.execute(stmt).scalars().all())

    valid_jobs = [j for j in jobs if not (isinstance(getattr(j, "raw_data", None), dict) and j.raw_data.get("is_expired") is True)]

    return valid_jobs


def is_valid_real_linkedin_job_url(url: Optional[str]) -> bool:
    """Validate an HTTPS LinkedIn job URL and a supported job listing ID."""
    if not url:
        return False
    try:
        parsed = urlsplit(url.strip())
        hostname = (parsed.hostname or "").lower().rstrip(".")
        if (
            parsed.scheme.lower() != "https"
            or not (hostname == "linkedin.com" or hostname.endswith(".linkedin.com"))
            or parsed.username
            or parsed.password
            or parsed.port not in (None, 443)
        ):
            return False
        path = parsed.path.rstrip("/")
        listing_id = re.fullmatch(r"/jobs/view/(\d+)", path, flags=re.IGNORECASE)
        collection_id = re.fullmatch(r"/jobs/collections/[^/]+", path, flags=re.IGNORECASE)
        collection_query_id = parse_qs(parsed.query).get("currentJobId", [""])[0]
        if not listing_id and not (collection_id and collection_query_id.isdigit()):
            return False
    except (ValueError, TypeError):
        return False
    return True



def build_hunter_config(
    profile: Profile,
    active_resume: Optional[Resume],
    search_cfg: Optional[SearchConfig],
    dry_run: bool = True,
    max_jobs: Optional[int] = None,
    allow_live_submission: bool = False,
    search_overrides: Optional[Dict[str, Any]] = None,
) -> HunterConfig:
    """Translate DB models into the domain HunterConfig."""
    prof_config = ProfileConfig(
        first_name=profile.first_name or "",
        last_name=profile.last_name or "",
        email=profile.email or "",
        phone=profile.phone or "",
        city=profile.city or "",
        state=profile.state or "",
        country=profile.country or "India",
        linkedin_url=profile.linkedin_url or "",
        github_url=profile.github_url or "",
        website=profile.website_url or "",
        years_of_experience=profile.experience_years if profile.experience_years is not None else 0,
        months_of_experience=profile.experience_months if profile.experience_months is not None else 0,
        notice_period_days=profile.notice_period_days if profile.notice_period_days is not None else 30,
        resume_path=active_resume.storage_path if active_resume else "resumes/resume.pdf",
    )

    keywords = "Software Engineer"
    location = "India"
    job_type = "full-time"
    experience_level = "mid-senior"
    remote = ""
    date_posted = "past-24h"
    easy_apply_only = True
    target_max_jobs = max_jobs or 25

    if search_cfg:
        keywords = " ".join(search_cfg.keywords) if isinstance(search_cfg.keywords, list) else str(search_cfg.keywords)
        location = search_cfg.location or "India"
        job_type = search_cfg.job_type or "full-time"
        experience_level = search_cfg.experience_level or "mid-senior"
        remote = search_cfg.remote_type or ""
        date_posted = search_cfg.date_posted or "past-24h"
        easy_apply_only = search_cfg.easy_apply_only
        target_max_jobs = max_jobs or search_cfg.max_jobs

    # Run-scoped overrides are snapshots on AutomationRun. They never update the
    # user's saved SearchConfig and remain optional for existing callers.
    if search_overrides:
        keywords_override = search_overrides.get("keywords")
        if keywords_override is not None:
            keywords = " ".join(keywords_override) if isinstance(keywords_override, list) else str(keywords_override)
        location = search_overrides.get("location", location) or location
        job_type = search_overrides.get("job_type", job_type) or job_type
        experience_level = search_overrides.get("experience_level", experience_level) or experience_level
        remote = search_overrides.get("remote_type", remote) or ""
        date_posted = search_overrides.get("date_posted", date_posted) or date_posted
        easy_apply_only = search_overrides.get("easy_apply_only", easy_apply_only)

    # Safety constraint: Live submission is strictly capped to 1 job
    if not dry_run and allow_live_submission:
        target_max_jobs = 1

    s_config = DomainSearchConfig(
        keywords=keywords,
        location=location,
        job_type=job_type,
        experience_level=experience_level,
        remote=remote,
        date_posted=date_posted,
        easy_apply_only=easy_apply_only,
        max_jobs=target_max_jobs,
    )

    # Custom answers from profile & skills
    custom_answers = []
    if profile.skills:
        for skill in profile.skills:
            years_val = skill.years
            if years_val:
                custom_answers.append(
                    CustomAnswer(
                        pattern=f"(?i).*{skill.name}.*(experience|years).*",
                        answer=str(int(years_val)),
                    )
                )

    ans_config = AnswersConfig(
        authorized_to_work=profile.authorized_to_work if profile.authorized_to_work is not None else True,
        willing_to_relocate=profile.willing_to_relocate if profile.willing_to_relocate is not None else True,
        current_salary=str(int(profile.current_ctc)) if profile.current_ctc else "0",
        desired_salary=str(int(profile.expected_ctc)) if profile.expected_ctc else "0",
        custom=custom_answers,
    )

    app_config = ApplyConfig(
        limit=target_max_jobs,
        allow_live_submission=allow_live_submission,
    )

    b_config = BrowserConfig(
        headless=False,
    )

    return HunterConfig(
        profile=prof_config,
        search=s_config,
        apply=app_config,
        answers=ans_config,
        browser=b_config,
    )


def evaluate_job_qualification(job: Job, profile: Profile) -> tuple[bool, int, List[str], List[str]]:
    """Evaluates whether a candidate qualifies for a job based on skills and profile requirements."""
    skills = profile.skills or []
    if not skills:
        return True, 100, [], []

    job_text = f"{job.title or ''} {job.description or ''}".lower()
    matched: List[str] = []
    missing: List[str] = []

    for s in skills:
        s_name = (s.name or "").strip().lower()
        if not s_name:
            continue
        pattern = r"\b" + re.escape(s_name) + r"\b"
        if re.search(pattern, job_text) or s_name in job_text:
            matched.append(s.name)
        else:
            missing.append(s.name)

    match_score = int(round((len(matched) / len(skills)) * 100)) if skills else 100

    # Qualified if candidate matches at least 1 skill or has >= 20% match
    is_qualified = len(matched) > 0 or match_score >= 20
    return is_qualified, match_score, matched, missing


async def execute_automation_run(
    run_id: uuid.UUID,
    user_id: uuid.UUID,
    dry_run: bool = True,
    max_jobs: Optional[int] = None,
    allow_live_submission: bool = False,
    live_submission_confirmation: Optional[str] = None,
    worker_id: Optional[str] = None,
) -> None:
    """Asynchronous worker task that executes a complete automation run."""
    # Triple-Key Submission Safety Interlock check
    is_real_submission_authorized = (
        not dry_run
        and allow_live_submission is True
        and live_submission_confirmation == "CONFIRM_REAL_SUBMISSION"
    )

    db = SessionLocal()
    try:
        stmt = (
            select(AutomationRun)
            .where(AutomationRun.id == run_id, AutomationRun.user_id == user_id)
            .options(selectinload(AutomationRun.search_config))
        )
        run = db.execute(stmt).scalar_one_or_none()
        if not run:
            logger.error("Automation run %s not found for user %s", run_id, user_id)
            return

        if run.status == "cancelled":
            return

        # Transition to running
        run.status = "running"
        run.started_at = datetime.utcnow()
        if worker_id:
            run.worker_id = worker_id
            now_utc = datetime.now(timezone.utc)
            run.locked_at = run.locked_at or now_utc
            run.heartbeat_at = now_utc
        db.commit()
        db.refresh(run)

        AutomationService.log_event(
            db=db,
            run_id=run.id,
            event="RUN_STARTED",
            message=f"Starting automation run (dry_run={dry_run}, allow_live_submission={allow_live_submission})",
            metadata_json={
                "dry_run": dry_run,
                "max_jobs": max_jobs,
                "allow_live_submission": allow_live_submission,
            },
        )

        p_stmt = (
            select(Profile)
            .where(Profile.id == user_id)
            .options(
                selectinload(Profile.skills),
                selectinload(Profile.experiences),
            )
        )
        profile = db.execute(p_stmt).scalar_one_or_none()
        if not profile:
            profile = Profile(id=user_id)
            db.add(profile)
            db.commit()
            db.refresh(profile)

        resume_query = select(Resume).where(Resume.user_id == user_id)
        if run.resume_id:
            resume_query = resume_query.where(Resume.id == run.resume_id)
        else:
            resume_query = resume_query.where(Resume.is_active == True).order_by(Resume.version.desc())
        active_resume = db.execute(resume_query).scalars().first()
        if run.selected_synced_job_ids is not None and active_resume is None:
            run.status = "failed"
            run.error_message = "The resume selected for this run is no longer available. Review the jobs and retry with an active resume."
            run.completed_at = datetime.utcnow()
            _close_pending_run_applications(db, run.id, "skipped", run.error_message)
            db.commit()
            return

        hunter_config = build_hunter_config(
            profile=profile,
            active_resume=active_resume,
            search_cfg=run.search_config,
            dry_run=dry_run,
            max_jobs=max_jobs,
            allow_live_submission=allow_live_submission,
            search_overrides=run.search_overrides,
        )

        keywords_str = hunter_config.search.keywords
        location_str = hunter_config.search.location
        limit_val = hunter_config.search.max_jobs

        # ── Preflight Session Validation (Fail-Fast Gate) ─────────────
        from backend.app.services.linkedin_session_validator import LinkedInSessionValidator
        validation = await LinkedInSessionValidator.validate_session(db, user_id)
        if not validation.is_valid:
            error_code = validation.error_code or "LINKEDIN_SESSION_EXPIRED"
            error_msg = validation.error_message or "Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue."
            AutomationService.log_event(
                db=db,
                run_id=run.id,
                level="error",
                event=error_code,
                message=error_msg,
                metadata_json={
                    "error_code": error_code,
                    "title": validation.error_title,
                    "detail": validation.detail,
                    "is_network_error": validation.is_network_error,
                },
            )
            run.status = "failed"
            run.error_message = f"{validation.error_title or 'LinkedIn session expired'}: {error_msg}"
            run.completed_at = datetime.utcnow()
            _close_pending_run_applications(db, run.id, "skipped", run.error_message)
            db.commit()
            AutomationService.log_event(
                db=db,
                run_id=run.id,
                level="error",
                event="RUN_FAILED",
                message="Automation run failed during LinkedIn session preflight.",
                metadata_json={"error_code": error_code},
            )
            return

        if validation.cookies:
            cookies = validation.cookies

        AutomationService.log_event(
            db=db,
            run_id=run.id,
            event="SEARCH_STARTED",
            message=f"Searching jobs for '{keywords_str}' in '{location_str}' (limit={limit_val})",
            metadata_json={
                "keywords": keywords_str,
                "location": location_str,
                "limit": limit_val,
            },
        )

        # ── Existing candidates, followed by live LinkedIn search if needed ──
        if run.selected_synced_job_ids is not None:
            selected_ids = [uuid.UUID(str(value)) for value in run.selected_synced_job_ids]
            synced_rows = list(db.execute(select(SyncedJob).where(
                SyncedJob.user_id == user_id,
                SyncedJob.id.in_(selected_ids),
            )).scalars().all())
            synced_by_id = {row.id: row for row in synced_rows}
            if len(synced_by_id) != len(selected_ids):
                run.status = "failed"
                run.error_message = "A selected synchronized job was removed or no longer belongs to this account."
                run.completed_at = datetime.utcnow()
                _close_pending_run_applications(db, run.id, "skipped", run.error_message)
                db.commit()
                return
            discovered_jobs = []
            for selected_id in selected_ids:
                row = synced_by_id[selected_id]
                job = db.get(Job, row.job_id) if row.job_id else None
                canonical_url = is_valid_real_linkedin_job_url(row.listing_url)
                id_matches = bool(re.search(rf"/jobs/view/{re.escape(str(row.linkedin_job_id or ''))}/?$", str(row.listing_url or ""), re.IGNORECASE))
                if row.source_platform != "linkedin" or not canonical_url or not id_matches or not job:
                    run.status = "failed"
                    run.error_message = "A selected job failed the worker's LinkedIn platform, URL, ID, or persistence recheck."
                    run.completed_at = datetime.utcnow()
                    _close_pending_run_applications(db, run.id, "skipped", run.error_message)
                    db.commit()
                    return
                discovered_jobs.append(job)
        else:
            discovered_jobs = select_eligible_unapplied_jobs(
                db=db,
                user_id=user_id,
                keywords_str=keywords_str,
                location_str=location_str,
                limit_val=limit_val,
                freshness_days=FRESHNESS_WINDOW_DAYS,
            )

        run.jobs_found = len(discovered_jobs)
        db.commit()

        if not discovered_jobs:
            AutomationService.log_event(
                db=db,
                run_id=run.id,
                event="NO_JOBS_FOUND",
                message="No fresh unapplied jobs found matching search criteria.",
                metadata_json={"keywords": keywords_str, "location": location_str},
            )
        else:
            AutomationService.log_event(
                db=db,
                run_id=run.id,
                event="SEARCH_COMPLETED",
                message=f"Discovered {len(discovered_jobs)} matching unapplied job vacancies.",
                metadata_json={"count": len(discovered_jobs)},
            )

        # ── Qualification & Application Execution ──────────────────────
        from linkedin_hunter.auth.session import check_session_health, has_valid_session, load_cookies
        from linkedin_hunter.browser.engine import BrowserEngine
        from linkedin_hunter.jobs.apply import execute_single_job_playwright_apply

        engine: Optional[BrowserEngine] = None
        session_health = {
            "authenticated": False,
            "session_available": False,
            "login_redirect": False,
            "checkpoint_detected": False,
            "details": "Session not initialized.",
        }

        engine: Optional[BrowserEngine] = None
        try:
            # ── 1. HARD CONSENT & SESSION GATES ─────────────────────────
            from backend.app.services.linkedin_session_service import (
                LinkedInSessionService,
                POLICY_TYPE_LINKEDIN,
            )
            from backend.app.db.models.linkedin_account import LinkedInAccount
            from backend.app.db.models.policy_acceptance import UserPolicyAcceptance

            # Check explicit permission consent
            consent = db.execute(
                select(UserPolicyAcceptance).where(
                    UserPolicyAcceptance.user_id == run.user_id,
                    UserPolicyAcceptance.policy_type == POLICY_TYPE_LINKEDIN,
                )
            ).scalars().first()

            if not consent:
                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    level="error",
                    event="CONSENT_REQUIRED",
                    message="LinkedIn automation consent has not been granted by user.",
                    metadata_json={"consent_required": True},
                )
                run.status = "failed"
                run.error_message = "LinkedIn permission consent required: Candidate must review and accept the LinkedIn automation purpose before launching."
                run.completed_at = datetime.utcnow()
                db.commit()
                return

            # Retrieve user's encrypted LinkedIn session from database
            user_account = db.execute(
                select(LinkedInAccount).where(LinkedInAccount.user_id == run.user_id)
            ).scalar_one_or_none()

            cookies: Optional[list[dict]] = None
            if user_account and user_account.encrypted_session:
                cookies = LinkedInSessionService.decrypt_session(user_account.encrypted_session)

            # Fallback to local cookie file for local CLI compatibility if not in database (non-production only)
            if not cookies and settings.ENVIRONMENT.lower() != "production":
                cookies = load_cookies()

            has_li_at = bool(cookies and any(c.get("name") == "li_at" for c in cookies))

            if not has_li_at:
                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    level="warning",
                    event="LINKEDIN_SESSION_INVALID",
                    message="No active LinkedIn session cookies available.",
                    metadata_json={"session_available": False},
                )
                run.status = "failed"
                run.error_message = "LinkedIn session authentication failed: No cookie session available. Please connect LinkedIn in RolePilot."
                run.completed_at = datetime.utcnow()
                if user_account and user_account.status == "connected":
                    user_account.status = "expired"
                db.commit()

                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    level="error",
                    event="RUN_FAILED",
                    message="Automation run failed: LinkedIn session authentication required.",
                    metadata_json={"error": "SESSION_UNAVAILABLE"},
                )
                return

            # Headless mode resolution: Enforce headless on Render / production / headless Linux;
            # preserve local config for manual visual inspection
            is_headless_server = (
                os.getenv("RENDER") == "true"
                or os.getenv("ENVIRONMENT") == "production"
                or (sys.platform.startswith("linux") and "DISPLAY" not in os.environ)
            )
            use_headless = True if is_headless_server else bool(hunter_config.browser.headless)

            # Pre-flight fail-fast check: Verify Chromium browser engine is installed and runnable
            from backend.app.services.browser_diagnostics import verify_browser_runtime, BrowserUnavailableException
            try:
                verify_browser_runtime()
            except BrowserUnavailableException as b_exc:
                diag = b_exc.diagnostics
                error_details = diag.get("details") or str(b_exc)
                remediation = diag.get("remediation") or ""
                full_error_msg = f"Chromium browser engine unavailable: {error_details}. Remediation: {remediation}"
                logger.error("Run %s aborted: %s", run.id, full_error_msg)

                run.status = "failed"
                run.error_message = full_error_msg
                run.completed_at = datetime.utcnow()
                db.commit()

                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    level="error",
                    event="BROWSER_UNAVAILABLE",
                    message=f"Chromium browser engine unavailable: {error_details}",
                    metadata_json=diag,
                )
                return

            AutomationService.log_event(
                db=db,
                run_id=run.id,
                event="BROWSER_STARTED",
                message="Launching Chromium browser engine.",
                metadata_json={"headless": use_headless},
            )
            engine = BrowserEngine(hunter_config)
            page = await engine.launch(headless=use_headless)
            if cookies:
                await engine.load_cookies(cookies)

            session_health = await check_session_health(page, cookies=cookies)
            if not session_health["authenticated"]:
                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    level="warning",
                    event="LINKEDIN_SESSION_INVALID",
                    message=f"LinkedIn session invalid: {session_health['details']}",
                    metadata_json=session_health,
                )
                if user_account:
                    user_account.status = "expired"

                run.status = "failed"
                run.error_message = f"LinkedIn session authentication failed: {session_health['details']}. Please reconnect your LinkedIn session."
                run.completed_at = datetime.utcnow()
                db.commit()

                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    level="error",
                    event="RUN_FAILED",
                    message=f"Automation run stopped: LinkedIn session is not authenticated ({session_health['details']}).",
                    metadata_json=session_health,
                )
                return

            # Session is authenticated
            if user_account:
                user_account.status = "connected"
                user_account.last_login_at = datetime.utcnow()
                db.commit()

            AutomationService.log_event(
                db=db,
                run_id=run.id,
                event="LINKEDIN_SESSION_VALID",
                message="LinkedIn session validated successfully.",
                metadata_json={"authenticated": True},
            )

            # Live LinkedIn Job Search (if live session is authenticated and more jobs needed)
            live_collected_jobs: List[Job] = []
            search_failure_info = None
            if run.selected_synced_job_ids is None and len(discovered_jobs) < limit_val and page:
                try:
                    from linkedin_hunter.jobs.search import (
                        collect_search_jobs,
                        SearchNavigationError,
                        SearchAuthError,
                        SearchCheckpointError,
                    )
                    needed_count = limit_val - len(discovered_jobs)
                    live_cards = await collect_search_jobs(page, hunter_config, target_count=needed_count)
                    for card in live_cards:
                        c_id, canonical_url = extract_canonical_job_identity(card.url, card.linkedin_id)
                        if not c_id:
                            continue

                        # Check if candidate already has an application record for this job
                        existing_job = JobService.get_job_by_linkedin_id(db, c_id)
                        already_applied_prior = False
                        if existing_job:
                            prior_app = db.execute(
                                select(Application.id).where(
                                    Application.user_id == user_id,
                                    Application.job_id == existing_job.id,
                                    Application.status.in_(["applied", "submitted", "already_applied"]),
                                )
                            ).scalar_one_or_none()
                            already_applied_prior = prior_app is not None

                        if already_applied_prior or card.already_applied:
                            # Record and skip already applied
                            job_row = JobService.upsert_job(
                                db=db,
                                linkedin_job_id=c_id,
                                title=card.title,
                                company=card.company,
                                job_url=canonical_url,
                                location=card.location,
                                raw_data={"last_validated_at": datetime.utcnow().isoformat(), "already_applied": True},
                            )
                            ApplicationService.record_application(
                                db=db,
                                user_id=user_id,
                                job_id=job_row.id,
                                status="applied",
                                application_url=canonical_url,
                            )
                            continue

                        job_row = JobService.upsert_job(
                            db=db,
                            linkedin_job_id=c_id,
                            title=card.title,
                            company=card.company,
                            job_url=canonical_url,
                            location=card.location,
                            raw_data={"last_validated_at": datetime.utcnow().isoformat()},
                        )
                        live_collected_jobs.append(job_row)
                except SearchAuthError as sa_err:
                    logger.warning("LinkedIn search redirected to auth/login: %s", sa_err)
                    search_failure_info = (
                        "LINKEDIN_SESSION_EXPIRED",
                        "LinkedIn session expired during job search. Please reconnect your account.",
                        str(sa_err),
                    )
                    if user_account:
                        user_account.status = "expired"
                except SearchCheckpointError as sc_err:
                    logger.warning("LinkedIn search encountered security checkpoint: %s", sc_err)
                    search_failure_info = (
                        "LINKEDIN_CHECKPOINT_DETECTED",
                        "LinkedIn security checkpoint or challenge detected during search.",
                        str(sc_err),
                    )
                except SearchNavigationError as sn_err:
                    logger.error("LinkedIn search navigation failed: %s", sn_err)
                    search_failure_info = (
                        "SEARCH_FAILED",
                        f"LinkedIn job search page failed to load: {str(sn_err)}",
                        str(sn_err),
                    )
                except Exception as search_err:
                    logger.error("Unexpected error during job search: %s", search_err)
                    search_failure_info = (
                        "SEARCH_FAILED",
                        f"Unexpected search error: {str(search_err)}",
                        str(search_err),
                    )

            if search_failure_info:
                err_code, err_msg, err_detail = search_failure_info
                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    level="error",
                    event=err_code,
                    message=err_msg,
                    metadata_json={
                        "error_code": err_code,
                        "detail": err_detail,
                        "keywords": keywords_str,
                        "location": location_str,
                    },
                )
                run.status = "failed"
                run.error_message = err_msg
                run.completed_at = datetime.utcnow()
                db.commit()
                return

            if live_collected_jobs:
                existing_ids = {j.id for j in discovered_jobs}
                for lj in live_collected_jobs:
                    if lj.id not in existing_ids:
                        discovered_jobs.append(lj)
                        existing_ids.add(lj.id)
                discovered_jobs = discovered_jobs[:limit_val]
                run.jobs_found = len(discovered_jobs)
                db.commit()
                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    event="LIVE_SEARCH_COMPLETED",
                    message=f"Live search retrieved {len(live_collected_jobs)} fresh jobs from LinkedIn.",
                    metadata_json={"live_count": len(live_collected_jobs), "total_count": len(discovered_jobs)},
                )
            elif not discovered_jobs:
                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    event="SEARCH_SUCCEEDED_EMPTY",
                    message="Search completed successfully. No matching jobs found for current search criteria.",
                    metadata_json={"keywords": keywords_str, "location": location_str},
                )

            seen_job_ids: set[str] = set()

            for job in discovered_jobs:
                job_key = str(job.id)
                if job_key in seen_job_ids:
                    continue
                seen_job_ids.add(job_key)

                # Update lease heartbeat and check for cooperative cancellation before each job
                from backend.app.services.queue_service import QueueService
                is_active = QueueService.update_heartbeat(
                    db=db,
                    run_id=run.id,
                    worker_id=worker_id or run.worker_id or "default",
                )
                if not is_active:
                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        event="RUN_CANCELLED",
                        message="Run was cancelled or lease invalidated.",
                    )
                    return

                # Pre-flight check: Was this job already applied by this user in a previous run?
                prior_applied_app = db.execute(
                    select(Application).where(
                        Application.user_id == user_id,
                        Application.job_id == job.id,
                        Application.status.in_(["applied", "submitted"]),
                    )
                ).scalar_one_or_none()

                if prior_applied_app:
                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        application_id=prior_applied_app.id,
                        level="info",
                        event="JOB_ALREADY_APPLIED",
                        message=f"Skipping {job.title}: Candidate already submitted an application previously.",
                        metadata_json={
                            "job_id": str(job.id),
                            "run_id": str(run.id),
                            "linkedin_job_id": job.linkedin_job_id,
                            "failure_category": "ALREADY_APPLIED",
                            "retryable": False,
                        },
                    )
                    run.applications_skipped += 1
                    run.jobs_processed += 1
                    db.commit()
                    continue

                # 1. Job Discovered
                AutomationService.log_event(
                    db=db,
                    run_id=run.id,
                    event="JOB_DISCOVERED",
                    message=f"Discovered job: {job.title} at {job.company}",
                    metadata_json={
                        "job_id": str(job.id),
                        "title": job.title,
                        "company": job.company,
                        "location": job.location,
                        "job_url": job.job_url,
                        "linkedin_job_id": job.linkedin_job_id,
                    },
                )

                # 2. Evaluate Qualification
                is_qualified, match_score, matched_skills, missing_skills = evaluate_job_qualification(job, profile)

                if is_qualified:
                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        event="JOB_QUALIFIED",
                        message=f"Candidate qualified ({match_score}% match) with skills: {', '.join(matched_skills) if matched_skills else 'General Match'}",
                        metadata_json={
                            "job_id": str(job.id),
                            "match_score": match_score,
                            "matched_skills": matched_skills,
                        },
                    )

                    # 3. Validate Job URL
                    if not is_valid_real_linkedin_job_url(job.job_url):
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            level="warning",
                            event="INVALID_LIVE_JOB_URL",
                            message=f"Job '{job.title}' has a synthetic or non-LinkedIn URL: {job.job_url}. Skipping live browser attempt.",
                            metadata_json={"job_id": str(job.id), "url": job.job_url, "failure_category": "INVALID_URL", "retryable": False},
                        )
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="skipped",
                            run_id=run.id,
                            application_url=job.job_url,
                            error_message="Invalid or synthetic LinkedIn URL",
                        )
                        run.applications_skipped += 1
                        run.jobs_processed += 1
                        db.commit()
                        continue

                    application = ApplicationService.record_application(
                        db=db,
                        user_id=user_id,
                        job_id=job.id,
                        status="in_progress",
                        run_id=run.id,
                        application_url=job.job_url,
                    )
                    application.started_at = datetime.utcnow()
                    curr_attempts = application.attempt_count if isinstance(application.attempt_count, int) else 0
                    application.attempt_count = max(1, curr_attempts) + 1
                    db.commit()

                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        event="APPLICATION_STARTED",
                        message=f"Starting browser application process for {job.title} at {job.company}",
                        metadata_json={"job_id": str(job.id), "dry_run": dry_run},
                    )

                    def log_cb(event: str, message: str, level: str = "info", metadata: Optional[dict] = None):
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            event=event,
                            level=level,
                            message=message,
                            metadata_json=metadata,
                        )

                    resume_file_path = active_resume.storage_path if active_resume else "resumes/resume.pdf"
                    playwright_res = await execute_single_job_playwright_apply(
                        page=page,
                        config=hunter_config,
                        job_url=job.job_url,
                        job_id=str(job.id),
                        job_title=job.title,
                        dry_run=dry_run,
                        allow_live_submission=allow_live_submission,
                        live_submission_confirmation=live_submission_confirmation,
                        resume_path=resume_file_path,
                        log_event_cb=log_cb,
                    )

                    if playwright_res.get("submission_confirmed"):
                        # Live run: Real application submitted and confirmed by post-submit check
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="applied",
                            submitted_at=datetime.utcnow(),
                            run_id=run.id,
                            application_url=job.job_url,
                        )
                        run.applications_submitted += 1
                        run.jobs_processed += 1
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            application_id=app_record.id,
                            event="APPLICATION_SUBMITTED",
                            message=f"Application submitted and confirmed for {job.title} at {job.company}",
                            metadata_json={
                                "job_id": str(job.id),
                                "run_id": str(run.id),
                                "application_id": str(app_record.id),
                                "linkedin_job_id": job.linkedin_job_id,
                                "confirmed": True,
                                "failure_category": "NONE",
                                "retryable": False,
                            },
                        )
                    elif playwright_res.get("submission_blocked"):
                        # Dry run or unconfirmed live run: Final submit blocked safely
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="dry_run_blocked",
                            run_id=run.id,
                            application_url=job.job_url,
                        )
                        run.jobs_processed += 1
                        # applications_submitted is NOT incremented for dry runs!
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            application_id=app_record.id,
                            event="DRY_RUN_COMPLETED",
                            message=f"[DRY RUN] Application verified and reviewed for {job.title} with submission safely blocked.",
                            metadata_json={
                                "job_id": str(job.id),
                                "run_id": str(run.id),
                                "application_id": str(app_record.id),
                                "linkedin_job_id": job.linkedin_job_id,
                                "dry_run": True,
                                "match_score": match_score,
                                "steps_completed": playwright_res.get("steps_completed", 0),
                                "fields_filled": playwright_res.get("fields_filled", 0),
                                "failure_category": "SUBMISSION_BLOCKED",
                                "retryable": False,
                            },
                        )
                    elif playwright_res.get("already_applied"):
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="applied",
                            run_id=run.id,
                            application_url=job.job_url,
                        )
                        run.applications_skipped += 1
                        run.jobs_processed += 1
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            application_id=app_record.id,
                            level="info",
                            event="JOB_ALREADY_APPLIED",
                            message=f"Job '{job.title}' detected as already applied on LinkedIn.",
                            metadata_json={
                                "job_id": str(job.id),
                                "run_id": str(run.id),
                                "application_id": str(app_record.id),
                                "linkedin_job_id": job.linkedin_job_id,
                                "failure_category": "ALREADY_APPLIED",
                                "retryable": False,
                            },
                        )
                    elif playwright_res.get("is_expired"):
                        job.raw_data = {**(job.raw_data or {}), "is_expired": True, "last_validated_at": datetime.utcnow().isoformat()}
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="skipped",
                            run_id=run.id,
                            application_url=job.job_url,
                            error_message="Job listing is closed or no longer accepting applications",
                        )
                        run.applications_skipped += 1
                        run.jobs_processed += 1
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            application_id=app_record.id,
                            level="warning",
                            event="JOB_EXPIRED",
                            message=f"Job '{job.title}' is closed or no longer accepting applications on LinkedIn.",
                            metadata_json={
                                "job_id": str(job.id),
                                "run_id": str(run.id),
                                "application_id": str(app_record.id),
                                "linkedin_job_id": job.linkedin_job_id,
                                "failure_category": "EXPIRED_LISTING",
                                "retryable": False,
                            },
                        )
                    elif playwright_res.get("skipped"):
                        fail_cat = playwright_res.get("failure_category", "NO_EASY_APPLY")
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="skipped",
                            run_id=run.id,
                            application_url=job.job_url,
                            error_message=playwright_res.get("error_message"),
                        )
                        run.applications_skipped += 1
                        run.jobs_processed += 1
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            application_id=app_record.id,
                            level="info",
                            event="APPLICATION_SKIPPED",
                            message=f"Skipped {job.title}: {playwright_res.get('error_message')}",
                            metadata_json={
                                "job_id": str(job.id),
                                "run_id": str(run.id),
                                "application_id": str(app_record.id),
                                "linkedin_job_id": job.linkedin_job_id,
                                "failure_category": fail_cat,
                                "retryable": False,
                            },
                        )
                    else:
                        submission_uncertain = bool(
                            is_real_submission_authorized and playwright_res.get("submission_attempted")
                        )
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="needs_verification" if submission_uncertain else "submission_failed",
                            run_id=run.id,
                            application_url=job.job_url,
                            error_message=playwright_res.get("error_message", "Playwright application execution failed"),
                        )
                        run.applications_failed += 1
                        run.jobs_processed += 1
                        AutomationService.log_event(
                            db=db,
                            run_id=run.id,
                            application_id=app_record.id,
                            level="error",
                            event="APPLICATION_NEEDS_VERIFICATION" if submission_uncertain else "APPLICATION_FAILED",
                            message=(
                                f"Application outcome needs verification for {job.title}: {playwright_res.get('error_message')}"
                                if submission_uncertain
                                else f"Application failed for {job.title}: {playwright_res.get('error_message')}"
                            ),
                            metadata_json={
                                "job_id": str(job.id),
                                "run_id": str(run.id),
                                "application_id": str(app_record.id),
                                "linkedin_job_id": job.linkedin_job_id,
                                "error": playwright_res.get("error_message"),
                                "failure_category": playwright_res.get("failure_category", "FORM_ERROR"),
                                "retryable": True,
                            },
                        )

                        # Ambiguous outcome safeguard: If live submission was attempted but outcome is ambiguous,
                        # flag as needs_reconciliation to prevent duplicate submissions.
                        if submission_uncertain:
                            from backend.app.services.queue_service import QueueService
                            QueueService.mark_needs_reconciliation(
                                db=db,
                                run_id=run.id,
                                reason=f"Application submission outcome was ambiguous for '{job.title}'. Flagged for reconciliation to prevent duplicate submissions.",
                            )
                            return

                else:
                    # Skipped due to qualification
                    app_record = ApplicationService.record_application(
                        db=db,
                        user_id=user_id,
                        job_id=job.id,
                        status="skipped",
                        run_id=run.id,
                        application_url=job.job_url,
                    )
                    run.applications_skipped += 1
                    run.jobs_processed += 1
                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        application_id=app_record.id,
                        level="warning",
                        event="JOB_SKIPPED",
                        message=f"Skipped {job.title} at {job.company}: Skills match below qualification threshold ({match_score}%).",
                        metadata_json={
                            "job_id": str(job.id),
                            "run_id": str(run.id),
                            "linkedin_job_id": job.linkedin_job_id,
                            "match_score": match_score,
                            "missing_skills": missing_skills,
                            "failure_category": "SKILLS_MISMATCH",
                            "retryable": False,
                        },
                    )

                db.commit()

        finally:
            if engine:
                try:
                    await engine.close()
                except Exception as e:
                    logger.warning("Error closing browser engine: %s", e)

        # ── Run Completed ──────────────────────────────────────────────
        db.refresh(run)
        if run.status not in ["cancelled", "failed"]:
            run.status = "completed"
            run.completed_at = datetime.utcnow()
            if not run.started_at:
                run.started_at = run.created_at or datetime.utcnow()
            db.commit()

            AutomationService.log_event(
                db=db,
                run_id=run.id,
                event="RUN_COMPLETED",
                message=f"Automation run completed. Processed: {run.jobs_processed}, Submitted: {run.applications_submitted}, Skipped: {run.applications_skipped}, Failed: {run.applications_failed}.",
                metadata_json={
                    "jobs_found": run.jobs_found,
                    "jobs_processed": run.jobs_processed,
                    "applications_submitted": run.applications_submitted,
                    "applications_skipped": run.applications_skipped,
                    "applications_failed": run.applications_failed,
                },
            )

            try:
                if dry_run:
                    n_title = "Dry Run Verified"
                    n_msg = f"Safe dry run completed: {run.jobs_processed} forms evaluated ({run.applications_submitted} verified eligible, {run.applications_skipped} skipped)."
                    n_type = "success"
                else:
                    n_title = "Automation Run Completed"
                    n_msg = f"Run completed: {run.applications_submitted} live applications submitted, {run.applications_skipped} skipped."
                    n_type = "success"

                NotificationService.create_notification(
                    db=db,
                    user_id=user_id,
                    title=n_title,
                    message=n_msg,
                    category="automation",
                    notification_type=n_type,
                    link=f"/automation?run={run.id}",
                    dedup_key=f"run_completed_{run.id}",
                )
            except Exception as ne:
                logger.warning("Could not dispatch completion notification: %s", ne)

    except Exception as e:
        logger.exception("Error executing automation run %s: %s", run_id, e)
        try:
            run = db.execute(
                select(AutomationRun).where(AutomationRun.id == run_id)
            ).scalar_one_or_none()
            if run:
                run.status = "failed"
                run.error_message = str(e)
                run.completed_at = datetime.utcnow()
                if not run.started_at:
                    run.started_at = run.created_at or datetime.utcnow()
                db.commit()

            AutomationService.log_event(
                db=db,
                run_id=run_id,
                level="error",
                event="RUN_FAILED",
                message=f"Automation run failed: {str(e)}",
            )

            try:
                NotificationService.create_notification(
                    db=db,
                    user_id=user_id,
                    title="Automation Run Failed",
                    message=f"Automation run encountered an error: {str(e)[:150]}",
                    category="automation",
                    notification_type="error",
                    link=f"/automation?run={run_id}",
                    dedup_key=f"run_failed_{run_id}",
                )
            except Exception as ne:
                logger.warning("Could not dispatch failure notification: %s", ne)
        except Exception:
            pass
    finally:
        db.close()


def run_linkedin_automation_task(
    run_id: uuid.UUID,
    user_id: uuid.UUID,
    dry_run: bool = True,
    max_jobs: Optional[int] = None,
    allow_live_submission: bool = False,
    live_submission_confirmation: Optional[str] = None,
) -> None:
    """Synchronous bridge for background task runner."""
    try:
        asyncio.run(
            execute_automation_run(
                run_id=run_id,
                user_id=user_id,
                dry_run=dry_run,
                max_jobs=max_jobs,
                allow_live_submission=allow_live_submission,
                live_submission_confirmation=live_submission_confirmation,
            )
        )
    except Exception as e:
        logger.exception("Task runner failed: %s", e)
