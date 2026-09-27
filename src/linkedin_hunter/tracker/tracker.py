"""Application tracking: duplicate detection, rate limits, session stats."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field

from linkedin_hunter.config import ApplyConfig
from linkedin_hunter.db.repository import ApplicationRepository, JobRepository
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


@dataclass
class SessionStats:
    applied: int = 0
    skipped: int = 0
    already_applied: int = 0
    blacklisted: int = 0
    failed: int = 0
    total_processed: int = 0

    @property
    def success_rate(self) -> float:
        if self.total_processed == 0:
            return 0.0
        return self.applied / self.total_processed * 100


class ApplicationTracker:
    """Tracks applications within a session and enforces limits."""

    def __init__(self, conn: sqlite3.Connection, apply_config: ApplyConfig):
        self.conn = conn
        self.config = apply_config
        self.app_repo = ApplicationRepository(conn)
        self.job_repo = JobRepository(conn)
        self.stats = SessionStats()
        self._applied_ids: set[int] = set()

    def should_skip_job(self, job_row: sqlite3.Row) -> str | None:
        """Check if a job should be skipped. Returns reason or None."""
        title = job_row["title"].lower()
        company = job_row["company"].lower()

        # Already applied
        if self.app_repo.was_applied(job_row["id"]):
            return "already applied"

        # Already processed this session
        if job_row["id"] in self._applied_ids:
            return "already processed this session"

        # Title blacklist
        for keyword in self.config.blacklist_title:
            if keyword.lower() in title:
                return f"blacklisted title keyword: {keyword}"

        # Company blacklist
        for comp in self.config.blacklist_companies:
            if comp.lower() in company:
                return f"blacklisted company: {comp}"

        return None

    def check_limits(self) -> str | None:
        """Check if we've hit any limits. Returns reason or None."""
        # Session limit
        if self.stats.applied >= self.config.limit:
            return f"session limit reached ({self.config.limit})"

        # Daily limit
        today_count = self.app_repo.count_today()
        if today_count >= self.config.daily_limit:
            return f"daily limit reached ({self.config.daily_limit})"

        return None

    def needs_break(self) -> bool:
        """Check if we need a mandatory break."""
        return (
            self.config.break_after > 0
            and self.stats.applied > 0
            and self.stats.applied % self.config.break_after == 0
        )

    def record_applied(self, job_id: int, dry_run: bool = False) -> None:
        self._applied_ids.add(job_id)
        self.stats.applied += 1
        self.stats.total_processed += 1
        self.app_repo.record_application(job_id, "submitted", dry_run=dry_run)
        log.info("Recorded application for job %d (dry_run=%s)", job_id, dry_run)

    def record_skipped(self, job_id: int, reason: str) -> None:
        self._applied_ids.add(job_id)
        self.stats.skipped += 1
        if "already applied" in reason.lower():
            self.stats.already_applied += 1
        elif "blacklist" in reason.lower():
            self.stats.blacklisted += 1
        self.stats.total_processed += 1
        self.app_repo.record_application(job_id, "skipped", error_message=reason)

    def record_failed(self, job_id: int, error: str) -> None:
        self._applied_ids.add(job_id)
        self.stats.failed += 1
        self.stats.total_processed += 1
        self.app_repo.record_application(job_id, "failed", error_message=error)
