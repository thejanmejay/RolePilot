"""Schemas for user-owned jobs synchronized from RolePilot for Chrome."""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExtractedJobInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    listing_id: Optional[str] = Field(default=None, max_length=80)
    listing_url: str = Field(max_length=2048)
    title: Optional[str] = Field(default=None, max_length=240)
    company: Optional[str] = Field(default=None, max_length=300)
    location: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=6000)
    workplace_type: Optional[str] = Field(default=None, max_length=80)
    employment_type: Optional[str] = Field(default=None, max_length=80)
    experience_level: Optional[str] = Field(default=None, max_length=80)
    is_easy_apply: Optional[bool] = None
    source_platform: str = Field(default="linkedin", max_length=40)
    source_page_url: str = Field(max_length=2048)


class ExtractedJobBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    jobs: List[ExtractedJobInput] = Field(min_length=1, max_length=100)


class SyncedJobItem(BaseModel):
    status: str
    reason: Optional[str] = None
    synced_job_id: Optional[uuid.UUID] = None
    job_id: Optional[uuid.UUID] = None
    listing_id: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    listing_url: Optional[str] = None
    observation_count: Optional[int] = None


class ExtractedJobBatchResponse(BaseModel):
    extraction_observations: int
    synchronized: int
    new_unique: int
    duplicates: int
    rejected: int
    items: List[SyncedJobItem]


class SyncedJobResponse(BaseModel):
    id: uuid.UUID
    job_id: Optional[uuid.UUID] = None
    linkedin_job_id: str
    listing_url: str
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    workplace_type: Optional[str] = None
    employment_type: Optional[str] = None
    experience_level: Optional[str] = None
    is_easy_apply: Optional[bool] = None
    source_platform: str
    source_page_url: str
    observation_count: int
    first_extracted_at: datetime
    last_extracted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobSelectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    synced_job_ids: List[uuid.UUID] = Field(min_length=1, max_length=100)
    search_config_id: Optional[uuid.UUID] = None

    @field_validator("synced_job_ids")
    @classmethod
    def unique_synced_job_ids(cls, value: List[uuid.UUID]) -> List[uuid.UUID]:
        if len(set(value)) != len(value):
            raise ValueError("Selected synchronized job IDs must be unique")
        return value


class JobSelectionItem(BaseModel):
    synced_job_id: uuid.UUID
    job_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    company: Optional[str] = None
    listing_url: str
    eligible: bool
    reason: Optional[str] = None


class JobSelectionPreviewResponse(BaseModel):
    extraction_observations: int
    synchronized_jobs: int
    eligible_count: int
    excluded_count: int
    eligible_jobs: List[JobSelectionItem]
    excluded_jobs: List[JobSelectionItem]
    search_config_id: Optional[uuid.UUID] = None
    search_criteria: dict
    resume_id: Optional[uuid.UUID] = None
    resume_name: Optional[str] = None
    prerequisites: dict
