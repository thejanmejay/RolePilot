"""Schemas for Platform Policy Acceptance and Consent Tracking."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PolicyAcceptRequest(BaseModel):
    """Client request to accept the platform policy."""
    policy_type: Optional[str] = None
    policy_version: Optional[str] = None


class PolicyAcceptResponse(BaseModel):
    """Response confirming recorded policy acceptance."""
    success: bool
    policy_type: str
    policy_version: str
    accepted_at: datetime
    message: str = "Platform policy accepted successfully."

    model_config = ConfigDict(from_attributes=True)


class PolicyStatusResponse(BaseModel):
    """Response indicating current acceptance status for the authenticated user."""
    has_accepted: bool
    policy_type: str
    required_version: str
    accepted_version: Optional[str] = None
    accepted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
