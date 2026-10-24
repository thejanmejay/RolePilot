"""Pydantic schemas for Job."""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class JobBase(BaseModel):
    linkedin_job_id: str
    title: str
    company: str
    location: Optional[str] = None
    job_url: str
    description: Optional[str] = None
    employment_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    posted_at: Optional[datetime] = None
    collected_at: Optional[datetime] = None


class JobResponse(JobBase):
    id: uuid.UUID
    raw_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
