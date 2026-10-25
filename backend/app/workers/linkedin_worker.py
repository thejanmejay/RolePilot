"""LinkedIn Automation Worker.

Orchestrates background automation runs by loading user profile, active resume,
skills, and search configurations from the database and driving the existing
linkedin_hunter domain engine.
"""

import asyncio
import logging
import re
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from backend.app.core.config import settings
from backend.app.db.database import SessionLocal
from backend.app.db.models.application import Application
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.job import Job
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.search_config import SearchConfig
from backend.app.services.application_service import ApplicationService
from backend.app.services.automation_service import AutomationService
from backend.app.services.job_service import JobService
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


def is_valid_real_linkedin_job_url(url: Optional[str]) -> bool:
    """Validate that the URL is a legitimate LinkedIn job URL and not a synthetic placeholder."""
    if not url:
        return False
    u = url.strip().lower()
    if not ("linkedin.com/jobs/view/" in u or "linkedin.com/jobs/collections/" in u or "linkedin.com/jobs/" in u):
        return False
    synthetic_markers = ["test-job", "example.com", "placeholder", "mock", "dummy", "localhost"]
    if any(marker in u for marker in synthetic_markers):
        return False
    return True



def build_hunter_config(
    profile: Profile,
    active_resume: Optional[Resume],
    search_cfg: Optional[SearchConfig],
    dry_run: bool = True,
    max_jobs: Optional[int] = None,
    allow_live_submission: bool = False,
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

        active_resume = db.execute(
            select(Resume)
            .where(Resume.user_id == user_id, Resume.is_active == True)
            .order_by(Resume.version.desc())
        ).scalars().first()

        hunter_config = build_hunter_config(
            profile=profile,
            active_resume=active_resume,
            search_cfg=run.search_config,
            dry_run=dry_run,
            max_jobs=max_jobs,
            allow_live_submission=allow_live_submission,
        )

        keywords_str = hunter_config.search.keywords
        location_str = hunter_config.search.location
        limit_val = hunter_config.search.max_jobs

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

        # ── Job Discovery ─────────────────────────────────────────────
        # Query matching jobs from the jobs database
        query_words = [w.strip() for w in keywords_str.replace(",", " ").split() if len(w.strip()) > 1]
        
        job_stmt = select(Job)
        if query_words:
            word_filters = []
            for w in query_words:
                word_filters.append(Job.title.ilike(f"%{w}%"))
                word_filters.append(Job.description.ilike(f"%{w}%"))
            job_stmt = job_stmt.where(or_(*word_filters))
        
        if location_str and location_str.lower() not in ["any", "all", "worldwide"]:
            job_stmt = job_stmt.where(Job.location.ilike(f"%{location_str}%"))

        job_stmt = job_stmt.order_by(Job.created_at.desc()).limit(limit_val)
        discovered_jobs = list(db.execute(job_stmt).scalars().all())

        # If strict search yielded 0 jobs, fall back to recent unapplied jobs to evaluate
        if not discovered_jobs:
            fallback_stmt = select(Job).order_by(Job.created_at.desc()).limit(limit_val)
            discovered_jobs = list(db.execute(fallback_stmt).scalars().all())

        run.jobs_found = len(discovered_jobs)
        db.commit()

        if not discovered_jobs:
            AutomationService.log_event(
                db=db,
                run_id=run.id,
                event="NO_JOBS_FOUND",
                message="No jobs found matching search criteria.",
                metadata_json={"keywords": keywords_str, "location": location_str},
            )
        else:
            AutomationService.log_event(
                db=db,
                run_id=run.id,
                event="SEARCH_COMPLETED",
                message=f"Discovered {len(discovered_jobs)} matching job vacancies.",
                metadata_json={"count": len(discovered_jobs)},
            )

        # ── Qualification & Application Execution ──────────────────────
        from linkedin_hunter.auth.session import check_session_health, has_valid_session, load_cookies
        from linkedin_hunter.browser.engine import BrowserEngine
        from linkedin_hunter.jobs.apply import execute_single_job_playwright_apply

        def is_valid_real_linkedin_job_url(url: Optional[str]) -> bool:
            """Validate that the URL is a legitimate LinkedIn job URL and not a synthetic placeholder."""
            if not url:
                return False
            u = url.strip().lower()
            if not ("linkedin.com/jobs/view/" in u or "linkedin.com/jobs/collections/" in u or "linkedin.com/jobs/" in u):
                return False
            synthetic_markers = ["test-job", "example.com", "placeholder", "mock", "dummy", "localhost"]
            if any(marker in u for marker in synthetic_markers):
                return False
            return True

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

            # Launch browser in headful mode by default for live visual inspection
            use_headless = hunter_config.browser.headless if hunter_config.browser.headless is True else False
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

            for job in discovered_jobs:
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
                            metadata_json={"job_id": str(job.id), "url": job.job_url},
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
                            metadata_json={"job_id": str(job.id), "application_id": str(app_record.id), "confirmed": True},
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
                                "application_id": str(app_record.id),
                                "dry_run": True,
                                "match_score": match_score,
                                "steps_completed": playwright_res.get("steps_completed", 0),
                                "fields_filled": playwright_res.get("fields_filled", 0),
                            },
                        )
                    elif playwright_res.get("skipped"):
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
                    else:
                        app_record = ApplicationService.record_application(
                            db=db,
                            user_id=user_id,
                            job_id=job.id,
                            status="submission_failed",
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
                            event="APPLICATION_FAILED",
                            message=f"Application failed for {job.title}: {playwright_res.get('error_message')}",
                            metadata_json={"job_id": str(job.id), "error": playwright_res.get("error_message")},
                        )

                        # Ambiguous outcome safeguard: If live submission was attempted but outcome is ambiguous,
                        # flag as needs_reconciliation to prevent duplicate submissions.
                        if is_real_submission_authorized and playwright_res.get("submission_attempted"):
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
                            "match_score": match_score,
                            "missing_skills": missing_skills,
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
                db.commit()

            AutomationService.log_event(
                db=db,
                run_id=run_id,
                level="error",
                event="RUN_FAILED",
                message=f"Automation run failed: {str(e)}",
            )
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
