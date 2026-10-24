"""Pydantic schemas for SearchConfig."""

import uuid
from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class SearchConfigBase(BaseModel):
    name: str = Field(..., max_length=255)
    keywords: Union[List[str], str] = Field(default_factory=list)
    location: Optional[str] = Field("India", max_length=255)
    job_type: Optional[str] = Field("full-time", max_length=50)
    experience_level: Optional[str] = Field("entry,associate", max_length=50)
    remote_type: Optional[str] = Field("", max_length=50)
    date_posted: Optional[str] = Field("past-week", max_length=50)
    easy_apply_only: bool = True
    salary_min: Optional[int] = 0
    salary_max: Optional[int] = 0
    max_jobs: int = Field(50, ge=1, le=200)
    is_active: bool = True


class SearchConfigCreate(SearchConfigBase):
    pass


class SearchConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    keywords: Optional[Union[List[str], str]] = None
    location: Optional[str] = Field(None, max_length=255)
    job_type: Optional[str] = Field(None, max_length=50)
    experience_level: Optional[str] = Field(None, max_length=50)
    remote_type: Optional[str] = Field(None, max_length=50)
    date_posted: Optional[str] = Field(None, max_length=50)
    easy_apply_only: Optional[bool] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    max_jobs: Optional[int] = Field(None, ge=1, le=200)
    is_active: Optional[bool] = None


class SearchConfigResponse(SearchConfigBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
