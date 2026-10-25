"""Pydantic schemas for LinkedIn session connection, status, and permission consent."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class LinkedInConnectRequest(BaseModel):
    """Payload to securely submit or refresh LinkedIn session credentials."""
    session_token: str = Field(
        ...,
        min_length=10,
        description="Encrypted or raw LinkedIn session cookie string (e.g., li_at value or cookies JSON)",
    )
    linkedin_profile_url: Optional[str] = Field(
        None,
        max_length=500,
        description="Public LinkedIn profile URL associated with this session",
    )


class LinkedInConsentRequest(BaseModel):
    """Payload to record explicit user permission and automation purpose consent."""
    accepted: bool = Field(..., description="Must be true to grant permission")
    policy_version: str = Field(
        "v1.0",
        description="Version identifier of the LinkedIn automation consent policy",
    )


class LinkedInStatusResponse(BaseModel):
    """Public status of a user's LinkedIn connection and consent."""
    is_connected: bool = Field(..., description="Whether a valid connected session exists")
    status: str = Field(..., description="Status value: connected, disconnected, expired, error")
    has_consent: bool = Field(..., description="Whether explicit permission consent has been granted")
    consent_version: Optional[str] = Field(None, description="Active accepted consent version")
    consent_accepted_at: Optional[datetime] = Field(None, description="Timestamp of accepted consent")
    last_login_at: Optional[datetime] = Field(None, description="Timestamp of last verified connection")
    linkedin_profile_url: Optional[str] = Field(None, description="Stored LinkedIn profile URL")

    model_config = ConfigDict(from_attributes=True)


class LinkedInConsentResponse(BaseModel):
    """Confirmation of recorded LinkedIn automation consent."""
    success: bool
    policy_version: str
    accepted_at: datetime


class LinkedInActionResponse(BaseModel):
    """Generic action confirmation for connect, disconnect, and revoke."""
    success: bool
    status: str
    message: str
