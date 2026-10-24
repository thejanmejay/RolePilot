"""Pydantic schemas for Application and ApplicationAnswer."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from backend.app.schemas.job import JobResponse


class ApplicationAnswerBase(BaseModel):
    question: str
    answer: str
    question_type: Optional[str] = None
    answer_source: Optional[str] = None
    confidence: Optional[float] = None


class ApplicationAnswerResponse(ApplicationAnswerBase):
    id: uuid.UUID
    application_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationCreate(BaseModel):
    job_id: uuid.UUID
    status: str = "saved"
    application_url: Optional[str] = None
    error_message: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    application_url: Optional[str] = None
    error_message: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    job_id: uuid.UUID
    run_id: Optional[uuid.UUID] = None
    status: str
    attempt_count: int = 1
    application_url: Optional[str] = None
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    job: Optional[JobResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ApplicationDetailResponse(ApplicationResponse):
    answers: List[ApplicationAnswerResponse] = []

