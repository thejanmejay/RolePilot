"""Durable Queue Worker Process for RolePilot Automation Runs.

Runs as a separate worker service on Render or background daemon.
Atomically claims pending runs via QueueService (PostgreSQL FOR UPDATE SKIP LOCKED),
maintains heartbeats, and recovers stale leases after worker crashes.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
import time
import uuid
from typing import Optional

from backend.app.db.database import SessionLocal
from backend.app.db.models.automation_run import AutomationRun
from backend.app.services.queue_service import QueueService
from backend.app.workers.linkedin_worker import execute_automation_run

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rolepilot.queue_worker")


class QueueWorker:
    def __init__(
        self,
        worker_id: Optional[str] = None,
        poll_interval: float = 2.0,
        lease_seconds: int = 300,
    ):
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.poll_interval = poll_interval
        self.lease_seconds = lease_seconds
        self._stop_requested = False

        # Attach graceful shutdown signal handlers
        try:
            signal.signal(signal.SIGINT, self._handle_signal)
            signal.signal(signal.SIGTERM, self._handle_signal)
        except (ValueError, AttributeError):
            pass

    def _handle_signal(self, signum, frame):
        logger.info("Signal %s received. Requesting worker shutdown...", signum)
        self._stop_requested = True

    def run_once(self) -> Optional[AutomationRun]:
        """Claim and execute at most one pending run from the durable queue."""
        db = SessionLocal()
        claimed_run: Optional[AutomationRun] = None
        try:
            claimed_run = QueueService.claim_next_run(
                db=db,
                worker_id=self.worker_id,
                lease_seconds=self.lease_seconds,
            )
            if not claimed_run:
                return None

            run_id = claimed_run.id
            user_id = claimed_run.user_id
            dry_run = claimed_run.dry_run
            max_jobs = claimed_run.max_jobs
            allow_live = claimed_run.allow_live_submission
            confirmation = claimed_run.live_submission_confirmation

            logger.info(
                "Worker %s executing run %s for user %s (dry_run=%s, live=%s)",
                self.worker_id,
                run_id,
                user_id,
                dry_run,
                allow_live,
            )

            # Execute run through worker engine
            asyncio.run(
                execute_automation_run(
                    run_id=run_id,
                    user_id=user_id,
                    dry_run=dry_run,
                    max_jobs=max_jobs,
                    allow_live_submission=allow_live,
                    live_submission_confirmation=confirmation,
                    worker_id=self.worker_id,
                )
            )

            db.refresh(claimed_run)
            return claimed_run
        except Exception as e:
            logger.exception("Error processing run in worker %s: %s", self.worker_id, e)
            if claimed_run:
                try:
                    db.refresh(claimed_run)
                    if claimed_run.status == "running":
                        claimed_run.status = "failed"
                        claimed_run.error_message = f"Worker runtime error: {e}"
                        db.commit()
                except Exception:
                    pass
            return claimed_run
        finally:
            db.close()

    def run_forever(self):
        """Continuously poll durable PostgreSQL queue for pending runs until stopped."""
        logger.info(
            "Starting RolePilot QueueWorker %s (poll_interval=%.1fs, lease_seconds=%ds)",
            self.worker_id,
            self.poll_interval,
            self.lease_seconds,
        )

        while not self._stop_requested:
            try:
                processed = self.run_once()
                if not processed:
                    time.sleep(self.poll_interval)
            except Exception as exc:
                logger.error("Unexpected error in worker loop: %s", exc)
                time.sleep(self.poll_interval)

        logger.info("QueueWorker %s cleanly stopped.", self.worker_id)

    @classmethod
    def process_run_by_id(
        cls,
        run_id: uuid.UUID,
        user_id: uuid.UUID,
        worker_id: Optional[str] = None,
    ) -> None:
        """Atomic execution of a specific run if claimed, used for immediate background dispatch."""
        w_id = worker_id or f"inline-{uuid.uuid4().hex[:8]}"
        db = SessionLocal()
        try:
            claimed = QueueService.claim_specific_run(db, run_id=run_id, worker_id=w_id)
            if not claimed:
                logger.info("Run %s was already claimed by another worker.", run_id)
                return

            dry_run = claimed.dry_run
            max_jobs = claimed.max_jobs
            allow_live = claimed.allow_live_submission
            confirmation = claimed.live_submission_confirmation

            asyncio.run(
                execute_automation_run(
                    run_id=run_id,
                    user_id=user_id,
                    dry_run=dry_run,
                    max_jobs=max_jobs,
                    allow_live_submission=allow_live,
                    live_submission_confirmation=confirmation,
                    worker_id=w_id,
                )
            )
        except Exception as e:
            logger.exception("Failed to execute run %s inline: %s", run_id, e)
        finally:
            db.close()


def main():
    parser = argparse.ArgumentParser(description="RolePilot Durable Queue Worker")
    parser.add_argument("--once", action="store_true", help="Process at most one job and exit")
    parser.add_argument("--interval", type=float, default=2.0, help="Polling interval in seconds")
    parser.add_argument("--lease", type=int, default=300, help="Lease duration in seconds")
    parser.add_argument("--worker-id", type=str, default=None, help="Explicit worker ID identifier")

    args = parser.parse_args()

    worker = QueueWorker(
        worker_id=args.worker_id,
        poll_interval=args.interval,
        lease_seconds=args.lease,
    )

    if args.once:
        run = worker.run_once()
        if run:
            print(f"Processed run: {run.id} (status={run.status})")
            sys.exit(0)
        else:
            print("No pending runs to process.")
            sys.exit(0)
    else:
        worker.run_forever()


if __name__ == "__main__":
    main()
