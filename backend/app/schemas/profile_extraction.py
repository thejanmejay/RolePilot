"""Pydantic schemas for smart profile extraction, portfolio analysis, and review."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExtractedSkill(BaseModel):
    name: str
    years: int = 1
    months: int = 0
    source: str = "resume"  # "resume" | "portfolio" | "user"


class ExtractedExperience(BaseModel):
    company_name: str
    job_title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    source: str = "resume"


class ExtractedEducation(BaseModel):
    institution: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_year: Optional[str] = None
    end_year: Optional[str] = None
    description: Optional[str] = None
    source: str = "resume"


class ExtractionConflict(BaseModel):
    field: str
    resume_value: Optional[str] = None
    portfolio_value: Optional[str] = None
    resolved_value: Optional[str] = None
    source_options: List[str] = Field(default_factory=list)


class ExtractedProfileData(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    headline: Optional[str] = None
    target_role: Optional[str] = None
    about: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    experience_years: int = 0
    experience_months: int = 0
    notice_period_days: Optional[int] = None
    expected_ctc: Optional[int] = None


class ProfileExtractionResult(BaseModel):
    sources: List[str] = Field(default_factory=list)  # ["resume", "portfolio"]
    profile: ExtractedProfileData
    skills: List[ExtractedSkill] = Field(default_factory=list)
    experiences: List[ExtractedExperience] = Field(default_factory=list)
    educations: List[ExtractedEducation] = Field(default_factory=list)
    conflicts: List[ExtractionConflict] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    source_attribution: Dict[str, str] = Field(default_factory=dict)
    is_readable: bool = True


class ApplyExtractionRequest(BaseModel):
    profile: ExtractedProfileData
    skills: List[ExtractedSkill] = Field(default_factory=list)
    experiences: List[ExtractedExperience] = Field(default_factory=list)
    educations: List[ExtractedEducation] = Field(default_factory=list)
    complete_onboarding: bool = True
