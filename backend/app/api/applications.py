"""Application API endpoints."""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.application import (
    ApplicationAnswerResponse,
    ApplicationCreate,
    ApplicationDetailResponse,
    ApplicationResponse,
    ApplicationUpdate,
)
from backend.app.services.application_service import ApplicationService

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationResponse])
def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    run_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List applications for the authenticated user."""
    return ApplicationService.get_user_applications(
        db=db,
        user_id=user_id,
        status=status_filter,
        run_id=run_id,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    app_in: ApplicationCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Save a job or track an application for the authenticated user."""
    return ApplicationService.record_application(
        db=db,
        user_id=user_id,
        job_id=app_in.job_id,
        status=app_in.status,
        application_url=app_in.application_url,
        error_message=app_in.error_message,
    )


@router.get("/{application_id}", response_model=ApplicationDetailResponse)
def get_application(
    application_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get details of a specific application for the authenticated user."""
    app = ApplicationService.get_application_by_id(db, user_id, application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return app


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: uuid.UUID,
    app_update: ApplicationUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update status, URL, or error message of an application."""
    app = ApplicationService.update_application(
        db=db,
        user_id=user_id,
        application_id=application_id,
        status=app_update.status,
        application_url=app_update.application_url,
        error_message=app_update.error_message,
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return app


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    application_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete an application / saved job."""
    success = ApplicationService.delete_application(
        db=db, user_id=user_id, application_id=application_id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )


@router.get("/{application_id}/answers", response_model=List[ApplicationAnswerResponse])
def get_application_answers(
    application_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get form answers recorded for a specific application."""
    app = ApplicationService.get_application_by_id(db, user_id, application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return ApplicationService.get_application_answers(db, user_id, application_id)

