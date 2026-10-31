"""Job API endpoints."""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.policy import require_policy_accepted
from backend.app.db.database import get_db
from backend.app.schemas.job import JobResponse
from backend.app.schemas.extension_jobs import ExtractedJobBatch, ExtractedJobBatchResponse, SyncedJobResponse
from backend.app.services.extension_job_service import ExtensionJobService
from backend.app.services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("/sync", response_model=ExtractedJobBatchResponse)
def sync_extension_jobs(
    batch: ExtractedJobBatch,
    user_id: uuid.UUID = Depends(require_policy_accepted),
    db: Session = Depends(get_db),
):
    """Synchronize a bounded set of directly linked LinkedIn listings for this user."""
    return ExtensionJobService.sync_batch(db, user_id, batch)


@router.get("/synced", response_model=List[SyncedJobResponse])
def list_synced_extension_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: uuid.UUID = Depends(require_policy_accepted),
    db: Session = Depends(get_db),
):
    """List only jobs observed and synchronized by the authenticated account."""
    return ExtensionJobService.list_for_user(db, user_id, skip=skip, limit=limit)


@router.get("", response_model=List[JobResponse])
def list_jobs(
    search: Optional[str] = Query(None, description="Search term in title or description"),
    company: Optional[str] = Query(None, description="Filter by company name"),
    location: Optional[str] = Query(None, description="Filter by location"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: uuid.UUID = Depends(require_policy_accepted),
    db: Session = Depends(get_db),
):
    """List global/shared LinkedIn jobs (authenticated users only)."""
    return JobService.get_jobs(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        company=company,
        location=location,
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_policy_accepted),
    db: Session = Depends(get_db),
):
    """Get details of a specific job by ID."""
    job = JobService.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return job
