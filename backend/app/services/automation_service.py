"""Automation service for managing LinkedIn automation runs and structured logs."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.db.models.automation_log import AutomationLog
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.application import Application
from backend.app.db.models.resume import Resume
from backend.app.db.models.search_config import SearchConfig
from backend.app.db.models.synced_job import SyncedJob
from backend.app.schemas.automation import AutomationRunCreate


class AutomationService:
    @staticmethod
    def create_run(
        db: Session, user_id: uuid.UUID, run_in: AutomationRunCreate
    ) -> AutomationRun:
        if run_in.search_config_id:
            stmt = select(SearchConfig).where(
                SearchConfig.id == run_in.search_config_id,
                SearchConfig.user_id == user_id,
            )
            config = db.execute(stmt).scalar_one_or_none()
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Search configuration not found or does not belong to user",
                )

        selected_records = []
        if run_in.selected_synced_job_ids is not None:
            selected_records = list(db.execute(select(SyncedJob).where(
                SyncedJob.user_id == user_id,
                SyncedJob.id.in_(run_in.selected_synced_job_ids),
            ).with_for_update()).scalars().all())
            if len(selected_records) != len(run_in.selected_synced_job_ids) or any(not row.job_id for row in selected_records):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="One or more selected jobs are no longer synchronized and eligible.")
            if not run_in.resume_id or not db.execute(select(Resume.id).where(
                Resume.id == run_in.resume_id,
                Resume.user_id == user_id,
                Resume.is_active.is_(True),
            )).scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An active resume owned by this account is required for this run.")

        # Idempotency check: Return existing run if idempotency_key is repeated
        if run_in.idempotency_key:
            from backend.app.services.queue_service import QueueService
            existing = QueueService.check_idempotency(db, user_id, run_in.idempotency_key)
            if existing:
                if run_in.selected_synced_job_ids is not None:
                    prior_ids = list(existing.selected_synced_job_ids or [])
                    requested_ids = [str(value) for value in run_in.selected_synced_job_ids]
                    if prior_ids != requested_ids or existing.dry_run != run_in.dry_run:
                        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Idempotency key was already used for a different selected job set or run mode.")
                return existing

        # Live submission safety: Capped to 1 job maximum
        effective_max_jobs = run_in.max_jobs or 10
        if not run_in.dry_run and run_in.allow_live_submission:
            effective_max_jobs = 1

        run = AutomationRun(
            user_id=user_id,
            search_config_id=run_in.search_config_id,
            search_overrides=(
                run_in.search_overrides.model_dump(exclude_none=True)
                if run_in.search_overrides
                else None
            ),
            selected_synced_job_ids=(
                [str(selected_id) for selected_id in run_in.selected_synced_job_ids]
                if run_in.selected_synced_job_ids is not None
                else None
            ),
            resume_id=run_in.resume_id,
            jobs_found=len(selected_records),
            status="pending",
            dry_run=run_in.dry_run,
            allow_live_submission=run_in.allow_live_submission,
            live_submission_confirmation=run_in.live_submission_confirmation,
            max_jobs=effective_max_jobs,
            idempotency_key=run_in.idempotency_key,
            attempt_count=0,
            max_attempts=3,
        )
        db.add(run)
        db.flush()

        # Reserve each user/job pair in the same transaction as the run. The
        # existing (user_id, job_id) unique key prevents parallel duplicate runs.
        for synced in selected_records:
            stmt = select(Application).where(
                Application.user_id == user_id,
                Application.job_id == synced.job_id,
            ).with_for_update()
            application = db.execute(stmt).scalar_one_or_none()
            if application and application.status in {
                "applied", "submitted", "already_applied", "pending", "in_progress",
                "needs_verification", "submission_uncertain",
            }:
                db.rollback()
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="One or more selected jobs already have an active, uncertain, or completed application.")
            if application:
                application.status = "pending"
                application.run_id = run.id
                application.application_url = synced.listing_url
                application.error_message = None
                application.started_at = None
            else:
                db.add(Application(
                    user_id=user_id,
                    job_id=synced.job_id,
                    run_id=run.id,
                    status="pending",
                    application_url=synced.listing_url,
                ))
        db.commit()
        db.refresh(run)

        # Log initial event
        AutomationService.log_event(
            db=db,
            run_id=run.id,
            event="RUN_PENDING",
            message=f"Automation run {run.id} created and pending queue worker pickup.",
            metadata_json={
                "dry_run": run_in.dry_run,
                "allow_live_submission": run_in.allow_live_submission,
                "max_jobs": effective_max_jobs,
                "selected_job_count": len(selected_records),
                "idempotency_key": run_in.idempotency_key,
            },
        )

        return run

    @staticmethod
    def get_runs(
        db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> List[AutomationRun]:
        stmt = (
            select(AutomationRun)
            .where(AutomationRun.user_id == user_id)
            .options(selectinload(AutomationRun.search_config))
            .order_by(AutomationRun.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_run_by_id(
        db: Session, user_id: uuid.UUID, run_id: uuid.UUID
    ) -> Optional[AutomationRun]:
        stmt = (
            select(AutomationRun)
            .where(
                AutomationRun.id == run_id,
                AutomationRun.user_id == user_id,
            )
            .options(
                selectinload(AutomationRun.search_config),
                selectinload(AutomationRun.logs),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_run_logs(
        db: Session, user_id: uuid.UUID, run_id: uuid.UUID
    ) -> List[AutomationLog]:
        run = AutomationService.get_run_by_id(db, user_id, run_id)
        if not run:
            return []

        stmt = (
            select(AutomationLog)
            .where(AutomationLog.run_id == run_id)
            .order_by(AutomationLog.created_at.asc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def cancel_run(
        db: Session, user_id: uuid.UUID, run_id: uuid.UUID
    ) -> Optional[AutomationRun]:
        run = AutomationService.get_run_by_id(db, user_id, run_id)
        if not run:
            return None

        if run.status in ["completed", "failed", "cancelled"]:
            return run

        run.status = "cancelled"
        run.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(run)

        AutomationService.log_event(
            db=db,
            run_id=run.id,
            event="RUN_CANCELLED",
            message=f"Automation run {run.id} was cancelled by user.",
        )

        return run

    @staticmethod
    def log_event(
        db: Session,
        run_id: uuid.UUID,
        event: str,
        message: Optional[str] = None,
        level: str = "INFO",
        metadata_json: Optional[Dict[str, Any]] = None,
        application_id: Optional[uuid.UUID] = None,
        **kwargs,
    ) -> AutomationLog:
        event_name = event or kwargs.get("event_type", "INFO")
        safe_meta = None
        if metadata_json:
            safe_meta = {
                k: v for k, v in metadata_json.items()
                if not any(secret_word in k.lower() for secret_word in ["password", "token", "secret", "jwt", "key", "auth"])
            }

        log = AutomationLog(
            run_id=run_id,
            application_id=application_id,
            level=(level or "info").lower(),
            event=event_name,
            message=message,
            metadata_json=safe_meta,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
