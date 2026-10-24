"""Pydantic schemas for AutomationRun and AutomationLog."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AutomationRunCreate(BaseModel):
    search_config_id: Optional[uuid.UUID] = None
    dry_run: bool = True
    max_jobs: Optional[int] = Field(None, ge=1, le=100)
    allow_live_submission: bool = False
    live_submission_confirmation: Optional[str] = None


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
    status: str
    dry_run: bool = False
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
