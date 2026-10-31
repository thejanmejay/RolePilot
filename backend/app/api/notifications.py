"""Notification API routes for RolePilot."""

from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    NotificationUnreadCountResponse,
)
from backend.app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    filter: str = Query("all", pattern="^(all|unread|read|updates)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Retrieve notifications for the current authenticated user."""
    items, total, unread_count = NotificationService.list_notifications(
        db, user_id=user_id, filter_mode=filter, limit=limit, offset=offset
    )
    return NotificationListResponse(
        items=items,
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def get_unread_count(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the current count of unread notifications."""
    count = NotificationService.get_unread_count(db, user_id=user_id)
    return NotificationUnreadCountResponse(unread_count=count)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Mark a specific notification as read."""
    notif = NotificationService.mark_as_read(db, notification_id, user_id)
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notif


@router.post("/mark-all-read")
def mark_all_notifications_read(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications as read."""
    count = NotificationService.mark_all_as_read(db, user_id)
    return {"success": True, "count": count}


@router.post("/{notification_id}/archive")
@router.delete("/{notification_id}")
def archive_notification(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Archive or remove a notification from active view."""
    success = NotificationService.archive_notification(db, notification_id, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"success": True}
