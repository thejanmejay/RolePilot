"""Service layer for creating, querying, and updating user notifications."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, select, update
from sqlalchemy.orm import Session

from backend.app.db.models.notification import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        user_id: uuid.UUID,
        title: str,
        message: str,
        category: str = "automation",
        notification_type: str = "info",
        link: Optional[str] = None,
        dedup_key: Optional[str] = None,
        metadata_json: Optional[str] = None,
    ) -> Notification:
        """Create a notification, deduplicating if an unread notification with same dedup_key exists."""
        try:
            if dedup_key:
                existing = (
                    db.execute(
                        select(Notification).where(
                            and_(
                                Notification.user_id == user_id,
                                Notification.dedup_key == dedup_key,
                                Notification.is_read.is_(False),
                                Notification.is_archived.is_(False),
                            )
                        )
                    )
                    .scalars()
                    .first()
                )
                if existing:
                    existing.title = title
                    existing.message = message
                    existing.category = category
                    existing.type = notification_type
                    existing.link = link
                    existing.created_at = datetime.now(timezone.utc)
                    if metadata_json:
                        existing.metadata_json = metadata_json
                    db.commit()
                    db.refresh(existing)
                    return existing

            notif = Notification(
                id=uuid.uuid4(),
                user_id=user_id,
                title=title,
                message=message,
                category=category,
                type=notification_type,
                link=link,
                is_read=False,
                is_archived=False,
                dedup_key=dedup_key,
                metadata_json=metadata_json,
            )
            db.add(notif)
            db.commit()
            db.refresh(notif)
            return notif
        except Exception:
            db.rollback()
            logger.exception("Failed to create notification for user %s", user_id)
            raise

    @staticmethod
    def list_notifications(
        db: Session,
        user_id: uuid.UUID,
        filter_mode: str = "all",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Notification], int, int]:
        """List notifications with unread count. filter_mode can be 'all', 'unread', 'read', 'updates'."""
        base_query = select(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_archived.is_(False),
            )
        )

        if filter_mode == "unread":
            base_query = base_query.where(Notification.is_read.is_(False))
        elif filter_mode == "read":
            base_query = base_query.where(Notification.is_read.is_(True))
        elif filter_mode == "updates":
            base_query = base_query.where(
                Notification.category.in_(["system", "account", "profile"])
            )

        total_query = select(func.count(Notification.id)).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_archived.is_(False),
            )
        )
        total = db.execute(total_query).scalar() or 0

        unread_count_query = select(func.count(Notification.id)).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
                Notification.is_archived.is_(False),
            )
        )
        unread_count = db.execute(unread_count_query).scalar() or 0

        items = (
            db.execute(
                base_query.order_by(Notification.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            .scalars()
            .all()
        )

        return list(items), total, unread_count

    @staticmethod
    def get_unread_count(db: Session, user_id: uuid.UUID) -> int:
        """Count unread unarchived notifications."""
        query = select(func.count(Notification.id)).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
                Notification.is_archived.is_(False),
            )
        )
        return db.execute(query).scalar() or 0

    @staticmethod
    def mark_as_read(
        db: Session, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[Notification]:
        """Mark a single notification as read."""
        notif = (
            db.execute(
                select(Notification).where(
                    and_(
                        Notification.id == notification_id,
                        Notification.user_id == user_id,
                    )
                )
            )
            .scalars()
            .first()
        )
        if not notif:
            return None

        notif.is_read = True
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def mark_all_as_read(db: Session, user_id: uuid.UUID) -> int:
        """Mark all unread notifications for a user as read."""
        result = db.execute(
            update(Notification)
            .where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read.is_(False),
                    Notification.is_archived.is_(False),
                )
            )
            .values(is_read=True)
        )
        db.commit()
        return result.rowcount

    @staticmethod
    def archive_notification(
        db: Session, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Archive a notification."""
        notif = (
            db.execute(
                select(Notification).where(
                    and_(
                        Notification.id == notification_id,
                        Notification.user_id == user_id,
                    )
                )
            )
            .scalars()
            .first()
        )
        if not notif:
            return False

        notif.is_archived = True
        db.commit()
        return True
