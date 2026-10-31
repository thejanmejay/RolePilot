"""Pydantic schemas for RolePilot notifications."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    category: str
    type: str
    link: Optional[str] = None
    is_read: bool
    is_archived: bool
    dedup_key: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int


class NotificationCreate(BaseModel):
    title: str
    message: str
    category: str = "automation"
    type: str = "info"
    link: Optional[str] = None
    dedup_key: Optional[str] = None
    metadata_json: Optional[str] = None
