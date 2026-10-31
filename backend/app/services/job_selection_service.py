"""Server-side preview of exact synchronized jobs against saved account data."""

from __future__ import annotations

import re
import uuid
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.db.models.application import Application
from backend.app.db.models.job import Job
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.search_config import SearchConfig
from backend.app.db.models.synced_job import SyncedJob
from backend.app.schemas.extension_jobs import JobSelectionItem
from backend.app.services.extension_job_service import _linked_in_url
from backend.app.services.linkedin_session_service import LinkedInSessionService
from backend.app.workers.linkedin_worker import evaluate_job_qualification


def _terms(value: Any) -> list[str]:
    if isinstance(value, list):
        raw = " ".join(str(part) for part in value)
    else:
        raw = str(value or "")
    raw = re.sub(r"[{}\"\']", " ", raw)
    return [term.lower() for term in re.split(r"[,\s]+", raw) if len(term.strip()) > 1]


def _matches_saved_preferences(record: SyncedJob, job, config: SearchConfig) -> Optional[str]:
    terms = _terms(config.keywords)
    searchable = f"{record.title or ''} {record.description or ''}".lower()
    if terms and not any(term in searchable for term in terms):
        return "Does not match the saved job keywords."
    if config.location and config.location.lower() not in {"any", "all", "worldwide"}:
        if not record.location or config.location.lower() not in record.location.lower():
            return "Does not match the saved location preference."
    if config.experience_level:
        wanted = [value.strip().lower() for value in config.experience_level.split(",") if value.strip()]
        actual = (record.experience_level or job.experience_level or "").lower()
        if not actual:
            return "Experience level is unavailable for the saved preference."
        if not any(value in actual for value in wanted):
            return "Does not match the saved experience-level preference."
    if config.remote_type:
        wanted = [value.strip().lower() for value in config.remote_type.split(",") if value.strip()]
        actual = (record.workplace_type or "").lower()
        if not actual:
            return "Workplace type is unavailable for the saved preference."
        if not any(value in actual for value in wanted):
            return "Does not match the saved workplace preference."
    if config.job_type:
        actual = (record.employment_type or job.employment_type or "").lower()
        if not actual:
            return "Job type is unavailable for the saved preference."
        if config.job_type.lower().replace("-", " ") not in actual.replace("-", " "):
            return "Does not match the saved job-type preference."
    if config.easy_apply_only:
        if record.is_easy_apply is not True:
            return "The saved preference requires Easy Apply, which is not confirmed for this listing."
    if config.salary_min and config.salary_min > 0:
        return "Salary is unavailable to verify the saved minimum salary preference."
    return None


class JobSelectionService:
    @staticmethod
    def preview(db: Session, user_id: uuid.UUID, synced_job_ids: list[uuid.UUID], search_config_id: uuid.UUID | None = None) -> dict[str, Any]:
        if not synced_job_ids or len(set(synced_job_ids)) != len(synced_job_ids):
            raise HTTPException(status_code=422, detail="Select one or more unique synchronized jobs.")

        records = list(db.execute(
            select(SyncedJob).where(
                SyncedJob.user_id == user_id,
                SyncedJob.id.in_(synced_job_ids),
            )
        ).scalars().all())
        if len(records) != len(synced_job_ids):
            # Do not disclose whether an ID belongs to another account.
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more synchronized jobs were not found.")
        by_id = {record.id: record for record in records}
        records = [by_id[job_id] for job_id in synced_job_ids]

        profile = db.execute(
            select(Profile).where(Profile.id == user_id).options(selectinload(Profile.skills))
        ).scalar_one_or_none()
        if search_config_id:
            config = db.execute(select(SearchConfig).where(
                SearchConfig.id == search_config_id,
                SearchConfig.user_id == user_id,
            )).scalar_one_or_none()
            if not config:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved search configuration not found.")
        else:
            config = db.execute(select(SearchConfig).where(
                SearchConfig.user_id == user_id,
            ).order_by(SearchConfig.is_active.desc(), SearchConfig.created_at.asc())).scalars().first()

        if not config:
            raise HTTPException(status_code=400, detail={
                "error_code": "SEARCH_CONFIG_REQUIRED",
                "message": "Create a saved search preference on the RolePilot website before reviewing these jobs.",
            })

        resume = db.execute(select(Resume).where(
            Resume.user_id == user_id,
            Resume.is_active.is_(True),
        ).order_by(Resume.version.desc())).scalars().first()
        linked_in = LinkedInSessionService.get_status(db, user_id)

        application_rows = {}
        global_ids = [record.job_id for record in records if record.job_id]
        if global_ids:
            apps = db.execute(select(Application).where(
                Application.user_id == user_id,
                Application.job_id.in_(global_ids),
            )).scalars().all()
            application_rows = {app.job_id: app for app in apps}

        eligible: list[JobSelectionItem] = []
        excluded: list[JobSelectionItem] = []
        for record in records:
            job = db.get(Job, record.job_id) if record.job_id else None
            reason = None
            canonical_url, url_error = _linked_in_url(record.listing_url, listing_id=record.linkedin_job_id)
            if record.source_platform != "linkedin":
                reason = "Applications for external job boards are not supported yet."
            elif url_error or not canonical_url:
                reason = url_error or "The LinkedIn listing URL is not supported."
            elif not record.title or not record.company or not job:
                reason = "A verified title and company are required before this listing can be applied to."
            elif not profile or not profile.onboarding_completed:
                reason = "Complete your RolePilot profile before applying."
            elif isinstance(job.raw_data, dict) and job.raw_data.get("is_expired") is True:
                reason = "This job listing is marked as expired."
            else:
                application = application_rows.get(record.job_id)
                if application and application.status in {"applied", "submitted", "already_applied"}:
                    reason = "An application is already recorded for this job."
                elif application and application.status in {"pending", "in_progress", "needs_verification", "submission_uncertain"}:
                    reason = "An application attempt is active or needs verification; retry is blocked to prevent duplicates."
                elif config and (preference_reason := _matches_saved_preferences(record, job, config)):
                    reason = preference_reason
                elif profile:
                    qualified, _, _, _ = evaluate_job_qualification(job, profile)
                    if not qualified:
                        reason = "This job does not meet the saved profile skill qualification rule."

            item = JobSelectionItem(
                synced_job_id=record.id,
                job_id=record.job_id,
                title=record.title,
                company=record.company,
                listing_url=record.listing_url,
                eligible=reason is None,
                reason=reason,
            )
            (eligible if reason is None else excluded).append(item)

        profile_ready = bool(profile and profile.onboarding_completed)
        return {
            "extraction_observations": sum(record.observation_count for record in records),
            "synchronized_jobs": len(records),
            "eligible_count": len(eligible),
            "excluded_count": len(excluded),
            "eligible_jobs": eligible,
            "excluded_jobs": excluded,
            "search_config_id": config.id,
            "search_criteria": {
                "keywords": config.keywords,
                "location": config.location,
                "experience_level": config.experience_level,
                "remote_type": config.remote_type,
                "job_type": config.job_type,
                "date_posted": config.date_posted,
                "easy_apply_only": config.easy_apply_only,
                "salary_min": config.salary_min,
                "salary_max": config.salary_max,
                "max_jobs": config.max_jobs,
            },
            "resume_id": resume.id if resume else None,
            "resume_name": resume.file_name if resume else None,
            "prerequisites": {
                "profile_ready": profile_ready,
                "active_resume": resume is not None,
                "linkedin_session": bool(linked_in.get("is_connected")),
                "linkedin_consent": bool(linked_in.get("has_consent")),
            },
        }
