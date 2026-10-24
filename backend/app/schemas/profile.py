"""Pydantic schemas for Profile, Experience, Skill, and LinkedInAccount."""

import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SkillBase(BaseModel):
    name: str = Field(..., max_length=100)
    years: int = Field(0, ge=0)
    months: int = Field(0, ge=0, le=11)


class SkillCreate(BaseModel):
    name: str = Field(..., max_length=100)
    years: Optional[int] = Field(0, ge=0)
    months: Optional[int] = Field(0, ge=0, le=11)
    years_experience: Optional[float] = Field(None, ge=0)
    years_of_experience: Optional[float] = Field(None, ge=0)


class BulkSkillsCreate(BaseModel):
    skills: List[SkillCreate] = Field(..., min_length=1)


class SkillResponse(SkillBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExperienceBase(BaseModel):
    company_name: str = Field(..., max_length=255)
    job_title: str = Field(..., max_length=255)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class ExperienceCreate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255)
    job_title: Optional[str] = Field(None, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    title: Optional[str] = Field(None, max_length=255)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class ExperienceResponse(ExperienceBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

class EducationBase(BaseModel):
    institution: str = Field(..., max_length=255)
    degree: Optional[str] = Field(None, max_length=255)
    field_of_study: Optional[str] = Field(None, max_length=255)
    start_year: Optional[str] = Field(None, max_length=50)
    end_year: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class EducationCreate(BaseModel):
    institution: Optional[str] = Field(None, max_length=255)
    school: Optional[str] = Field(None, max_length=255)
    degree: Optional[str] = Field(None, max_length=255)
    field_of_study: Optional[str] = Field(None, max_length=255)
    field: Optional[str] = Field(None, max_length=255)
    start_year: Optional[str] = Field(None, max_length=50)
    end_year: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class EducationResponse(EducationBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    headline: Optional[str] = None
    target_role: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0)
    experience_months: Optional[int] = Field(None, ge=0, le=11)
    notice_period_days: Optional[int] = Field(None, ge=0)
    current_ctc: Optional[float] = None
    expected_ctc: Optional[float] = None
    authorized_to_work: Optional[bool] = None
    willing_to_relocate: Optional[bool] = None
    onboarding_completed: Optional[bool] = False
    onboarding_completed_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    headline: Optional[str] = None
    target_role: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0)
    experience_months: Optional[int] = Field(None, ge=0, le=11)
    notice_period_days: Optional[int] = Field(None, ge=0)
    current_ctc: Optional[float] = None
    expected_ctc: Optional[float] = None
    authorized_to_work: Optional[bool] = None
    willing_to_relocate: Optional[bool] = None
    onboarding_completed: Optional[bool] = None


class OnboardingRequest(BaseModel):
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    headline: str = Field(..., min_length=2, max_length=255, description="Professional title or headline")
    target_role: str = Field(..., min_length=2, max_length=255, description="Primary target role or job search goal")
    experience_years: int = Field(0, ge=0, description="Total years of experience")
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field("India", max_length=100)
    phone: Optional[str] = Field(None, max_length=50)


class ProfileResponse(ProfileBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    skills: List[SkillResponse] = []
    experiences: List[ExperienceResponse] = []
    educations: List[EducationResponse] = []

    model_config = ConfigDict(from_attributes=True)
