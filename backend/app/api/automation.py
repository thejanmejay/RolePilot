"""Automation API endpoints."""

import uuid
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.application import ApplicationResponse
from backend.app.schemas.automation import (
    AutomationLogResponse,
    AutomationRunCreate,
    AutomationRunResponse,
)
from backend.app.services.application_service import ApplicationService
from backend.app.services.automation_service import AutomationService
from backend.app.workers.linkedin_worker import run_linkedin_automation_task

router = APIRouter(prefix="/automation", tags=["Automation"])


@router.post("/runs", response_model=AutomationRunResponse, status_code=status.HTTP_201_CREATED)
def create_automation_run(
    run_in: AutomationRunCreate,
    background_tasks: BackgroundTasks,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new automation run and queue the worker task in the background."""
    run = AutomationService.create_run(db, user_id, run_in)

    # Safety enforcement: live submission run is strictly limited to max_jobs=1
    effective_max_jobs = run_in.max_jobs
    if not run_in.dry_run and run_in.allow_live_submission:
        effective_max_jobs = 1

    # Dispatch to background worker
    background_tasks.add_task(
        run_linkedin_automation_task,
        run_id=run.id,
        user_id=user_id,
        dry_run=run_in.dry_run,
        max_jobs=effective_max_jobs,
        allow_live_submission=run_in.allow_live_submission,
        live_submission_confirmation=run_in.live_submission_confirmation,
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

