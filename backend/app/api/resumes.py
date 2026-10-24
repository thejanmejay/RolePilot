"""Resume API endpoints."""

import uuid
from typing import List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.api.policy import require_policy_accepted
from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.resume import ResumeResponse
from backend.app.services.resume_service import ResumeService

router = APIRouter(
    prefix="/resumes",
    tags=["Resumes"],
    dependencies=[Depends(require_policy_accepted)],
)


@router.post("/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Upload a new PDF resume, extract text/metadata, and activate it."""
    return await ResumeService.upload_and_create_resume(db, user_id, file)


@router.get("", response_model=List[ResumeResponse])
def list_resumes(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all resumes belonging to the authenticated user."""
    return ResumeService.get_resumes(db, user_id)


@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get details of a specific resume belonging to the authenticated user."""
    resume = ResumeService.get_resume_by_id(db, user_id, resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    return resume


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(
    resume_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a resume belonging to the authenticated user."""
    success = ResumeService.delete_resume(db, user_id, resume_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
