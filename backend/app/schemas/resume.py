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
    is_valid_document: bool = False
    document_status: str = "pending_verification"
    file_mime_type: str = "application/pdf"
    parsed_text: Optional[str] = None
    parsed_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConflictField(BaseModel):
    field: str
    label: str
    current_value: Optional[Any] = None
    extracted_value: Optional[Any] = None
    description: str


class ProfileSyncDiff(BaseModel):
    fields_updated: Dict[str, Dict[str, Any]] = {}
    skills_to_add: list[str] = []
    experiences_to_add: list[Dict[str, Any]] = []
    educations_to_add: list[Dict[str, Any]] = []
    conflicts: list[ConflictField] = []
    preserved_fields: list[str] = []


class ResumeReplacementResponse(BaseModel):
    new_resume: ResumeResponse
    previous_active_resume_id: Optional[uuid.UUID] = None
    diff: ProfileSyncDiff
    has_conflicts: bool
    status: str = "parsed_awaiting_confirmation"


class ResumeActivationRequest(BaseModel):
    accepted_fields: Optional[Dict[str, Any]] = None
    add_skills: bool = True
    add_experiences: bool = True
    add_educations: bool = True
    clear_stale_fields: bool = False


class ResumeActivationResponse(BaseModel):
    resume: ResumeResponse
    message: str
    profile_updated: bool = True
