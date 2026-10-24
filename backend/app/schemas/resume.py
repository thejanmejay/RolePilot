"""Pydantic schemas for Resume."""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class ResumeBase(BaseModel):
    file_name: str
    storage_path: str
    is_active: bool = True


class ResumeCreate(ResumeBase):
    version: int = 1
    parsed_text: Optional[str] = None
    parsed_data: Optional[Dict[str, Any]] = None


class ResumeResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    file_name: str
    storage_path: str
    version: int
    is_active: bool
    parsed_text: Optional[str] = None
    parsed_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
