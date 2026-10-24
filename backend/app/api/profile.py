"""Profile API endpoints."""

import uuid
from typing import List, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.api.policy import require_policy_accepted
from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.profile import (
    BulkSkillsCreate,
    EducationCreate,
    EducationResponse,
    ExperienceCreate,
    ExperienceResponse,
    OnboardingRequest,
    ProfileResponse,
    ProfileUpdate,
    SkillCreate,
    SkillResponse,
)
from backend.app.services.profile_service import ProfileService

router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
    dependencies=[Depends(require_policy_accepted)],
)


@router.get("", response_model=ProfileResponse)
def get_profile(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Retrieve the profile of the authenticated user."""
    return ProfileService.get_or_create_profile(db, user_id)


@router.patch("", response_model=ProfileResponse)
def update_profile(
    profile_in: ProfileUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update the profile of the authenticated user."""
    return ProfileService.update_profile(db, user_id, profile_in)


@router.post("/onboarding", response_model=ProfileResponse)
def complete_onboarding(
    payload: OnboardingRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Complete initial candidate profile onboarding."""
    return ProfileService.complete_onboarding(db, user_id, payload)


@router.post("/onboarding/finalize", response_model=ProfileResponse)
def finalize_onboarding(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Finalize structured candidate onboarding enforcing all 4 required sections."""
    return ProfileService.finalize_onboarding(db, user_id)


@router.post("/skills", response_model=Union[List[SkillResponse], SkillResponse], status_code=status.HTTP_201_CREATED)
def add_skills(
    payload: Union[BulkSkillsCreate, List[SkillCreate], SkillCreate],
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add or update skills for the authenticated user (supports single skill or bulk list/object)."""
    if isinstance(payload, BulkSkillsCreate):
        return ProfileService.add_skills(db, user_id, payload.skills)
    elif isinstance(payload, list):
        return ProfileService.add_skills(db, user_id, payload)
    else:
        return ProfileService.add_skill(db, user_id, payload)


@router.post("/skills/bulk", response_model=List[SkillResponse], status_code=status.HTTP_201_CREATED)
def add_skills_bulk(
    payload: BulkSkillsCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Explicit endpoint to bulk add or update skills for the authenticated user."""
    return ProfileService.add_skills(db, user_id, payload.skills)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(
    skill_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a skill for the authenticated user."""
    success = ProfileService.delete_skill(db, user_id, skill_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found or does not belong to user",
        )


@router.post("/experiences", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
def add_experience(
    exp_in: ExperienceCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add a work experience for the authenticated user."""
    return ProfileService.add_experience(db, user_id, exp_in)


@router.put("/experiences/{exp_id}", response_model=ExperienceResponse)
def update_experience(
    exp_id: uuid.UUID,
    exp_in: ExperienceCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update a work experience for the authenticated user."""
    updated = ProfileService.update_experience(db, user_id, exp_id, exp_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experience not found or does not belong to user",
        )
    return updated


@router.delete("/experiences/{exp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(
    exp_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a work experience for the authenticated user."""
    success = ProfileService.delete_experience(db, user_id, exp_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experience not found or does not belong to user",
        )


@router.post("/educations", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
def add_education(
    edu_in: EducationCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add education record for the authenticated user."""
    return ProfileService.add_education(db, user_id, edu_in)


@router.delete("/educations/{edu_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(
    edu_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete education record for the authenticated user."""
    success = ProfileService.delete_education(db, user_id, edu_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education record not found or does not belong to user",
        )

