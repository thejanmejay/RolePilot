"""Automation API endpoints."""

import uuid
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.policy import require_policy_accepted
from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.application import ApplicationResponse
from backend.app.schemas.automation import (
    AutomationSearchOverrides,
    AutomationLogResponse,
    AutomationRunCreate,
    AutomationRunResponse,
)
from backend.app.services.application_service import ApplicationService
from backend.app.services.automation_service import AutomationService
from backend.app.services.job_selection_service import JobSelectionService
from backend.app.schemas.extension_jobs import JobSelectionPreviewResponse, JobSelectionRequest
from backend.app.workers.linkedin_worker import run_linkedin_automation_task

router = APIRouter(
    prefix="/automation",
    tags=["Automation"],
    dependencies=[Depends(require_policy_accepted)],
)


@router.post("/selection-preview", response_model=JobSelectionPreviewResponse)
def preview_automation_selection(
    request: JobSelectionRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Compute exact eligibility and exclusions for the user's synchronized jobs."""
    return JobSelectionService.preview(db, user_id, request.synced_job_ids, request.search_config_id)


@router.post("/runs", response_model=AutomationRunResponse, status_code=status.HTTP_201_CREATED)
async def create_automation_run(
    run_in: AutomationRunCreate,
    background_tasks: BackgroundTasks,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Validate LinkedIn session preflight first, create a new automation run, and queue the worker task in the background."""
    # 1. Enforce Server-Side LinkedIn Session Preflight Validation
    from backend.app.services.linkedin_session_validator import LinkedInSessionValidator

    validation = await LinkedInSessionValidator.validate_session(db, user_id)
    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": validation.error_code,
                "title": validation.error_title or "LinkedIn session expired",
                "message": validation.error_message or "Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue.",
                "action": "reconnect_linkedin" if validation.error_code in ("LINKEDIN_SESSION_EXPIRED", "LINKEDIN_SESSION_INVALID", "LINKEDIN_SESSION_MISSING") else "retry",
                "is_network_error": validation.is_network_error,
            },
        )

    # Consent is checked by the worker too. Reject it here as well so a run
    # cannot be queued and only fail asynchronously when the prerequisite is
    # already absent at request time.
    from backend.app.services.linkedin_session_service import LinkedInSessionService

    linkedin_status = LinkedInSessionService.get_status(db, user_id)
    if not linkedin_status.get("has_consent"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "LINKEDIN_CONSENT_REQUIRED",
                "title": "LinkedIn automation consent required",
                "message": "Review and accept the LinkedIn automation purpose on the RolePilot website before starting a run.",
                "action": "accept_linkedin_consent",
            },
        )

    if run_in.idempotency_key:
        from backend.app.services.queue_service import QueueService
        existing_run = QueueService.check_idempotency(db, user_id, run_in.idempotency_key)
        if existing_run:
            return existing_run

    if run_in.selected_synced_job_ids is not None:
        preview = JobSelectionService.preview(
            db,
            user_id,
            run_in.selected_synced_job_ids,
            run_in.search_config_id,
        )
        eligible_ids = {str(item.synced_job_id) for item in preview["eligible_jobs"]}
        selected_ids = [str(job_id) for job_id in run_in.selected_synced_job_ids]
        excluded_by_id = {str(item.synced_job_id): item.reason for item in preview["excluded_jobs"]}
        ineligible = [job_id for job_id in selected_ids if job_id not in eligible_ids]
        if ineligible:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "SELECTED_JOBS_NO_LONGER_ELIGIBLE",
                    "message": "One or more selected jobs are no longer eligible. Review the refreshed selection before starting.",
                    "excluded": [{"synced_job_id": job_id, "reason": excluded_by_id.get(job_id)} for job_id in ineligible],
                },
            )
        if not preview["prerequisites"]["profile_ready"]:
            raise HTTPException(status_code=400, detail={
                "error_code": "PROFILE_SETUP_REQUIRED",
                "message": "Complete RolePilot profile setup before starting an application run.",
            })
        selected_resume_id = preview.get("resume_id")
        if not selected_resume_id:
            raise HTTPException(status_code=400, detail={
                "error_code": "ACTIVE_RESUME_REQUIRED",
                "message": "Select an active resume on RolePilot before starting an application run.",
            })
        if run_in.resume_id and str(run_in.resume_id) != str(selected_resume_id):
            raise HTTPException(status_code=409, detail={
                "error_code": "RESUME_SELECTION_CHANGED",
                "message": "The active resume changed after review. Refresh the selection and review again.",
            })
        if not run_in.dry_run and len(selected_ids) > 1:
            raise HTTPException(status_code=422, detail={
                "error_code": "LIVE_RUN_SINGLE_JOB_LIMIT",
                "message": "The existing live-submission workflow is limited to one selected job per run.",
            })

        criteria = preview["search_criteria"]
        run_in.search_config_id = preview["search_config_id"]
        run_in.resume_id = selected_resume_id
        run_in.search_overrides = AutomationSearchOverrides(
            keywords=" ".join(criteria["keywords"]) if isinstance(criteria["keywords"], list) else str(criteria["keywords"]),
            location=criteria["location"],
            job_type=criteria["job_type"],
            experience_level=criteria["experience_level"],
            remote_type=criteria["remote_type"],
            date_posted=criteria["date_posted"],
            easy_apply_only=criteria["easy_apply_only"],
        )
        run_in.max_jobs = len(selected_ids)

    # 2. Validation succeeded -> create run and queue task
    run = AutomationService.create_run(db, user_id, run_in)

    # Dispatch to background task runner or queue worker atomically
    from backend.app.workers.queue_worker import QueueWorker
    background_tasks.add_task(
        QueueWorker.process_run_by_id,
        run_id=run.id,
        user_id=user_id,
    )

    return run


@router.get("/runs", response_model=List[AutomationRunResponse])
def list_automation_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all automation runs belonging to the authenticated user."""
    return AutomationService.get_runs(db, user_id, skip=skip, limit=limit)


@router.get("/runs/{run_id}", response_model=AutomationRunResponse)
def get_automation_run(
    run_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the status and statistics of a specific automation run."""
    run = AutomationService.get_run_by_id(db, user_id, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation run not found",
        )
    return run


@router.get("/runs/{run_id}/logs", response_model=List[AutomationLogResponse])
def get_automation_run_logs(
    run_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get structured event logs for a specific automation run."""
    logs = AutomationService.get_run_logs(db, user_id, run_id)
    return logs


@router.get("/runs/{run_id}/applications", response_model=List[ApplicationResponse])
def get_automation_run_applications(
    run_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get applications processed during a specific automation run."""
    run = AutomationService.get_run_by_id(db, user_id, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation run not found",
        )
    return ApplicationService.get_user_applications(db, user_id, run_id=run_id)


@router.post("/runs/{run_id}/cancel", response_model=AutomationRunResponse)
def cancel_automation_run(
    run_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Cancel a queued or running automation run."""
    run = AutomationService.cancel_run(db, user_id, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation run not found",
        )
    return run

