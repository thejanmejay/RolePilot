"""QueueService: Durable PostgreSQL Queue, Atomic Claiming, Leases, and Crash Recovery."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models.automation_run import AutomationRun
from backend.app.services.automation_service import AutomationService

logger = logging.getLogger("linkedin_hunter.queue_service")


class QueueService:
    @classmethod
    def check_idempotency(
        cls, db: Session, user_id: uuid.UUID, idempotency_key: str
    ) -> Optional[AutomationRun]:
        """Check if an automation run with the given idempotency key exists for this user."""
        if not idempotency_key:
            return None

        stmt = select(AutomationRun).where(
            AutomationRun.user_id == user_id,
            AutomationRun.idempotency_key == idempotency_key,
        ).order_by(AutomationRun.created_at.desc()).limit(1)

        return db.execute(stmt).scalar_one_or_none()

    @classmethod
    def recover_stale_leases(cls, db: Session, lease_seconds: int = 300) -> int:
        """Scan for runs stuck in 'running' whose worker heartbeat has expired.
        
        Safeguards:
        - If any applications were submitted or live submission was enabled, transition to 'needs_reconciliation'.
          NEVER auto-retry ambiguous or live submissions to prevent duplicate applications.
        - If attempts reached max_attempts, mark as 'failed'.
        - Otherwise, re-queue as 'pending' for bounded retry.
        """
        now = datetime.now(timezone.utc)
        stale_threshold = now - timedelta(seconds=lease_seconds)

        stmt = select(AutomationRun).where(
            AutomationRun.status == "running",
            (AutomationRun.heartbeat_at < stale_threshold)
            | ((AutomationRun.heartbeat_at.is_(None)) & (AutomationRun.locked_at < stale_threshold)),
        )

        stale_runs = db.execute(stmt).scalars().all()
        recovered_count = 0

        for run in stale_runs:
            recovered_count += 1
            # Ambiguous outcome safeguard: do not retry if live submission or applications submitted
            is_ambiguous = run.allow_live_submission or run.applications_submitted > 0

            if is_ambiguous:
                run.status = "needs_reconciliation"
                run.completed_at = now
                run.error_message = (
                    f"Worker heartbeat timed out after {lease_seconds}s with live submission or completed applications. "
                    "Marked as needs_reconciliation to prevent duplicate submissions."
                )
                try:
                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        level="warning",
                        event="RUN_NEEDS_RECONCILIATION",
                        message=run.error_message,
                        metadata_json={
                            "worker_id": run.worker_id,
                            "attempt_count": run.attempt_count,
                            "applications_submitted": run.applications_submitted,
                        },
                    )
                except Exception as log_err:
                    logger.warning("Could not log RUN_NEEDS_RECONCILIATION: %s", log_err)
            elif run.attempt_count >= run.max_attempts:
                run.status = "failed"
                run.completed_at = now
                run.error_message = f"Exceeded maximum execution attempts ({run.max_attempts}) after worker timeout."
                try:
                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        level="error",
                        event="RUN_FAILED",
                        message=run.error_message,
                        metadata_json={"worker_id": run.worker_id, "attempts": run.attempt_count},
                    )
                except Exception as log_err:
                    logger.warning("Could not log RUN_FAILED: %s", log_err)
            else:
                # Safe bounded retry: re-queue run
                run.status = "pending"
                prev_worker = run.worker_id
                run.worker_id = None
                run.locked_at = None
                run.heartbeat_at = None
                try:
                    AutomationService.log_event(
                        db=db,
                        run_id=run.id,
                        level="warning",
                        event="RUN_REQUEUED",
                        message=f"Worker {prev_worker} heartbeat timed out. Requeued for retry ({run.attempt_count}/{run.max_attempts}).",
                        metadata_json={"previous_worker": prev_worker, "attempt": run.attempt_count},
                    )
                except Exception as log_err:
                    logger.warning("Could not log RUN_REQUEUED: %s", log_err)

        if recovered_count > 0:
            db.commit()
            logger.info("Recovered %d stale automation runs", recovered_count)

        return recovered_count

    @classmethod
    def claim_next_run(
        cls, db: Session, worker_id: str, lease_seconds: int = 300
    ) -> Optional[AutomationRun]:
        """Atomically claim the next eligible pending run using PostgreSQL FOR UPDATE SKIP LOCKED.
        
        Guarantees that competing workers will never claim the same run concurrently.
        """
        # First recover any stale leases
        cls.recover_stale_leases(db, lease_seconds=lease_seconds)

        now = datetime.now(timezone.utc)

        # Build query for oldest eligible pending or queued run
        query = (
            select(AutomationRun)
            .where(
                AutomationRun.status.in_(["pending", "queued"]),
                AutomationRun.attempt_count < AutomationRun.max_attempts,
            )
            .order_by(AutomationRun.created_at.asc())
            .limit(1)
        )

        # Apply PostgreSQL atomic row lock with skip locked
        dialect_name = getattr(getattr(db, "bind", None), "dialect", None)
        dialect_str = getattr(dialect_name, "name", "") if dialect_name else ""
        if dialect_str == "postgresql":
            query = query.with_for_update(skip_locked=True)

        run = db.execute(query).scalar_one_or_none()
        if not run:
            return None

        # Atomically claim the run
        run.status = "running"
        run.worker_id = worker_id
        run.locked_at = now
        run.heartbeat_at = now
        run.started_at = run.started_at or now
        run.attempt_count = (run.attempt_count or 0) + 1

        db.commit()
        db.refresh(run)

        try:
            AutomationService.log_event(
                db=db,
                run_id=run.id,
                level="info",
                event="RUN_CLAIMED",
                message=f"Run claimed by worker {worker_id} (attempt {run.attempt_count}/{run.max_attempts}).",
                metadata_json={"worker_id": worker_id, "attempt": run.attempt_count},
            )
        except Exception as log_err:
            db.rollback()
            logger.warning("Could not record RUN_CLAIMED event log: %s", log_err)

        return run

    @classmethod
    def claim_specific_run(
        cls, db: Session, run_id: uuid.UUID, worker_id: str
    ) -> Optional[AutomationRun]:
        """Atomically claim a specific run by ID if still pending."""
        now = datetime.now(timezone.utc)

        query = (
            select(AutomationRun)
            .where(
                AutomationRun.id == run_id,
                AutomationRun.status.in_(["pending", "queued"]),
            )
        )

        dialect_name = getattr(getattr(db, "bind", None), "dialect", None)
        dialect_str = getattr(dialect_name, "name", "") if dialect_name else ""
        if dialect_str == "postgresql":
            query = query.with_for_update(skip_locked=True)

        run = db.execute(query).scalar_one_or_none()
        if not run:
            return None

        run.status = "running"
        run.worker_id = worker_id
        run.locked_at = now
        run.heartbeat_at = now
        run.started_at = run.started_at or now
        run.attempt_count = (run.attempt_count or 0) + 1

        db.commit()
        db.refresh(run)
        return run

    @classmethod
    def update_heartbeat(cls, db: Session, run_id: uuid.UUID, worker_id: str) -> bool:
        """Update lease heartbeat timestamp. Returns False if run was cancelled or revoked."""
        now = datetime.now(timezone.utc)

        run = db.execute(
            select(AutomationRun).where(
                AutomationRun.id == run_id,
                AutomationRun.worker_id == worker_id,
            )
        ).scalar_one_or_none()

        if not run:
            return False

        # Cooperative cancellation check: if user clicked Cancel, tell worker to halt
        if run.status in ["cancelled", "failed", "completed"]:
            return False

        run.heartbeat_at = now
        db.commit()
        return True

    @classmethod
    def mark_needs_reconciliation(
        cls, db: Session, run_id: uuid.UUID, reason: str
    ) -> None:
        """Flag run as needs_reconciliation following an ambiguous live application result."""
        now = datetime.now(timezone.utc)
        run = db.execute(
            select(AutomationRun).where(AutomationRun.id == run_id)
        ).scalar_one_or_none()

        if run:
            run.status = "needs_reconciliation"
            run.completed_at = now
            run.error_message = reason
            db.commit()

            AutomationService.log_event(
                db=db,
                run_id=run_id,
                level="warning",
                event="RUN_NEEDS_RECONCILIATION",
                message=reason,
                metadata_json={"needs_reconciliation": True},
            )
