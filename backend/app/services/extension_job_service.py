"""Validated synchronization of LinkedIn jobs extracted by RolePilot for Chrome."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models.job import Job
from backend.app.db.models.synced_job import SyncedJob
from backend.app.schemas.extension_jobs import ExtractedJobBatch, SyncedJobItem


def _linked_in_url(value: str, *, listing_id: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    try:
        parsed = urlsplit((value or "").strip())
        hostname = (parsed.hostname or "").lower().rstrip(".")
        if (
            parsed.scheme.lower() != "https"
            or not (hostname == "linkedin.com" or hostname.endswith(".linkedin.com"))
            or parsed.username
            or parsed.password
            or parsed.port not in (None, 443)
        ):
            return None, "URL must use HTTPS on LinkedIn."
        path_match = re.fullmatch(r"/jobs/view/(\d+)/?", parsed.path, flags=re.IGNORECASE)
        if not path_match:
            return None, "Only direct LinkedIn job listings are supported for applications."
        parsed_id = path_match.group(1)
        if listing_id and (not listing_id.isdigit() or listing_id != parsed_id):
            return None, "The listing ID does not match the LinkedIn job URL."
        return f"https://www.linkedin.com/jobs/view/{parsed_id}/", None
    except (TypeError, ValueError):
        return None, "The listing URL is invalid."


def _linkedin_source_page(value: str) -> bool:
    try:
        parsed = urlsplit((value or "").strip())
        hostname = (parsed.hostname or "").lower().rstrip(".")
        return (
            parsed.scheme.lower() == "https"
            and (hostname == "linkedin.com" or hostname.endswith(".linkedin.com"))
            and not parsed.username
            and not parsed.password
            and parsed.port in (None, 443)
        )
    except (TypeError, ValueError):
        return False


def _clean(value: Optional[str], limit: int) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(str(value).split()).strip()
    return cleaned[:limit] or None


class ExtensionJobService:
    @staticmethod
    def sync_batch(db: Session, user_id: uuid.UUID, batch: ExtractedJobBatch) -> dict[str, Any]:
        """Persist a bounded batch atomically; rejected records do not poison valid siblings."""
        observations = len(batch.jobs)
        synchronized = new_unique = duplicates = rejected = 0
        items: list[SyncedJobItem] = []
        now = datetime.now(timezone.utc)

        try:
            for item in batch.jobs:
                listing_id = _clean(item.listing_id, 80)
                canonical_url, reason = _linked_in_url(item.listing_url, listing_id=listing_id)
                source_platform = (item.source_platform or "").strip().lower()
                if reason is None and source_platform != "linkedin":
                    reason = "Only LinkedIn listings can be synchronized for applications."
                if reason is None and not _linkedin_source_page(item.source_page_url):
                    reason = "The source page must be an HTTPS LinkedIn page."
                if reason:
                    rejected += 1
                    items.append(SyncedJobItem(status="rejected", reason=reason, listing_id=listing_id, title=_clean(item.title, 240), company=_clean(item.company, 300), listing_url=item.listing_url[:2048]))
                    continue

                parsed_id = re.search(r"/jobs/view/(\d+)/$", canonical_url or "").group(1)
                global_job = db.execute(
                    select(Job).where(Job.linkedin_job_id == parsed_id)
                ).scalar_one_or_none()
                title = _clean(item.title, 240)
                company = _clean(item.company, 300)
                if global_job is None and title and company:
                    global_job = Job(
                        linkedin_job_id=parsed_id,
                        title=title,
                        company=company,
                        location=_clean(item.location, 300),
                        description=_clean(item.description, 6000),
                        job_url=canonical_url,
                        employment_type=_clean(item.employment_type, 80),
                        experience_level=_clean(item.experience_level, 80),
                        raw_data={
                            "source_platform": "linkedin",
                            "workplace_type": _clean(item.workplace_type, 80),
                            "is_easy_apply": item.is_easy_apply,
                            "source": "rolepilot_chrome",
                        },
                    )
                    db.add(global_job)
                    db.flush()

                synced = db.execute(
                    select(SyncedJob).where(
                        SyncedJob.user_id == user_id,
                        SyncedJob.linkedin_job_id == parsed_id,
                    )
                ).scalar_one_or_none()
                is_duplicate = synced is not None
                if synced is None:
                    synced = SyncedJob(
                        user_id=user_id,
                        linkedin_job_id=parsed_id,
                        job_id=global_job.id if global_job else None,
                        listing_url=canonical_url,
                        title=title,
                        company=company,
                        location=_clean(item.location, 300),
                        description=_clean(item.description, 6000),
                        workplace_type=_clean(item.workplace_type, 80),
                        employment_type=_clean(item.employment_type, 80),
                        experience_level=_clean(item.experience_level, 80),
                        is_easy_apply=item.is_easy_apply,
                        source_platform="linkedin",
                        source_page_url=item.source_page_url,
                        observation_count=1,
                        first_extracted_at=now,
                        last_extracted_at=now,
                    )
                    db.add(synced)
                    db.flush()
                    new_unique += 1
                    item_status = "new"
                else:
                    synced.observation_count += 1
                    synced.last_extracted_at = now
                    synced.source_page_url = item.source_page_url
                    synced.listing_url = canonical_url
                    synced.title = title or synced.title
                    synced.company = company or synced.company
                    synced.location = _clean(item.location, 300) or synced.location
                    synced.description = _clean(item.description, 6000) or synced.description
                    synced.workplace_type = _clean(item.workplace_type, 80) or synced.workplace_type
                    synced.employment_type = _clean(item.employment_type, 80) or synced.employment_type
                    synced.experience_level = _clean(item.experience_level, 80) or synced.experience_level
                    if item.is_easy_apply is not None:
                        synced.is_easy_apply = item.is_easy_apply
                    if global_job:
                        synced.job_id = global_job.id
                    duplicates += 1
                    item_status = "duplicate"

                synchronized += 1
                items.append(SyncedJobItem(
                    status=item_status,
                    synced_job_id=synced.id,
                    job_id=synced.job_id,
                    listing_id=parsed_id,
                    title=synced.title,
                    company=synced.company,
                    listing_url=synced.listing_url,
                    observation_count=synced.observation_count,
                    reason="Job details are incomplete; saved for history but not eligible until title and company are available." if not synced.job_id else None,
                ))
            db.commit()
        except Exception:
            db.rollback()
            raise

        return {
            "extraction_observations": observations,
            "synchronized": synchronized,
            "new_unique": new_unique,
            "duplicates": duplicates,
            "rejected": rejected,
            "items": items,
        }

    @staticmethod
    def list_for_user(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 100) -> list[SyncedJob]:
        return list(db.execute(
            select(SyncedJob)
            .where(SyncedJob.user_id == user_id)
            .order_by(SyncedJob.last_extracted_at.desc())
            .offset(skip)
            .limit(limit)
        ).scalars().all())
