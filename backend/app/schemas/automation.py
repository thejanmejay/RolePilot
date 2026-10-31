"""Pydantic schemas for AutomationRun and AutomationLog."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.app.schemas.search import SearchConfigResponse


class AutomationSearchOverrides(BaseModel):
    model_config = ConfigDict(extra="forbid")

    keywords: Optional[str] = Field(default=None, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    job_type: Optional[str] = Field(default=None, max_length=50)
    experience_level: Optional[str] = Field(default=None, max_length=50)
    remote_type: Optional[str] = Field(default=None, max_length=50)
    date_posted: Optional[str] = Field(default=None, max_length=50)
    easy_apply_only: Optional[bool] = None

    @field_validator("keywords", "location")
    @classmethod
    def trim_text(cls, value: Optional[str], info) -> Optional[str]:
        if value is None:
            return None
        clean = value.strip()
        if not clean and info.field_name == "location":
            return clean
        if not clean:
            raise ValueError("Value cannot contain only whitespace")
        return clean

    @field_validator("job_type")
    @classmethod
    def validate_job_type(cls, value: Optional[str]) -> Optional[str]:
        allowed = {"full-time", "part-time", "contract", "temporary", "internship", "volunteer", "other"}
        if value is not None and value not in allowed:
            raise ValueError("Unsupported job type")
        return value

    @field_validator("experience_level", "remote_type")
    @classmethod
    def validate_filter_list(cls, value: Optional[str], info) -> Optional[str]:
        if value is None or value == "":
            return value
        allowed = (
            {"internship", "entry", "associate", "mid-senior", "director", "executive"}
            if info.field_name == "experience_level"
            else {"on-site", "remote", "hybrid"}
        )
        values = [part.strip() for part in value.split(",") if part.strip()]
        if not values or any(part not in allowed for part in values):
            raise ValueError("Unsupported search filter")
        return ",".join(dict.fromkeys(values))

    @field_validator("date_posted")
    @classmethod
    def validate_date_posted(cls, value: Optional[str]) -> Optional[str]:
        allowed = {"past-hour", "past-3h", "past-6h", "past-12h", "past-24h", "past-week", "past-month", "any"}
        if value is not None and value not in allowed:
            raise ValueError("Unsupported posting date filter")
        return value


class AutomationRunCreate(BaseModel):
    search_config_id: Optional[uuid.UUID] = None
    search_overrides: Optional[AutomationSearchOverrides] = None
    selected_synced_job_ids: Optional[List[uuid.UUID]] = Field(default=None, min_length=1, max_length=100)
    resume_id: Optional[uuid.UUID] = None
    dry_run: bool = True
    max_jobs: Optional[int] = Field(default=None, ge=1, le=100)
    allow_live_submission: bool = False
    live_submission_confirmation: Optional[str] = None
    idempotency_key: Optional[str] = Field(default=None, max_length=128)

    @field_validator("selected_synced_job_ids")
    @classmethod
    def unique_selected_job_ids(cls, value: Optional[List[uuid.UUID]]) -> Optional[List[uuid.UUID]]:
        if value is not None and len(set(value)) != len(value):
            raise ValueError("Selected job IDs must be unique")
        return value


class AutomationLogResponse(BaseModel):
    id: int
    run_id: uuid.UUID
    application_id: Optional[uuid.UUID] = None
    level: str
    event: str
    message: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AutomationRunResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    search_config_id: Optional[uuid.UUID] = None
    search_config: Optional[SearchConfigResponse] = None
    search_overrides: Optional[Dict[str, Any]] = None
    selected_synced_job_ids: Optional[List[uuid.UUID]] = None
    resume_id: Optional[uuid.UUID] = None
    cancel_requested: bool = False
    status: str
    dry_run: bool = False
    allow_live_submission: bool = False
    max_jobs: int = 10
    worker_id: Optional[str] = None
    attempt_count: int = 0
    max_attempts: int = 3
    idempotency_key: Optional[str] = None
    jobs_found: int = 0
    jobs_processed: int = 0
    applications_submitted: int = 0
    applications_failed: int = 0
    applications_skipped: int = 0
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AutomationRunDetailResponse(AutomationRunResponse):
    logs: List[AutomationLogResponse] = []
