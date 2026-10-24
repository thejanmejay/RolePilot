"""Consolidated single-run Playwright validation script."""

import asyncio
import uuid
from backend.app.db.database import SessionLocal
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.automation_log import AutomationLog
from backend.app.workers.linkedin_worker import execute_automation_run

async def main():
    db = SessionLocal()
    user_id = uuid.UUID("fff82230-c47c-4917-b383-7d371f3645a4")
    run_id = uuid.uuid4()
    
    run = AutomationRun(
        id=run_id,
        user_id=user_id,
        status="queued",
        jobs_found=0,
        jobs_processed=0,
        applications_submitted=0,
        applications_skipped=0,
        applications_failed=0,
    )
    db.add(run)
    db.commit()
    db.close()
    
    print(f"=== Starting Consolidated Live Validation: Run ID {run_id} ===")
    await execute_automation_run(run_id=run_id, user_id=user_id, dry_run=True, max_jobs=1)
    
    db = SessionLocal()
    completed_run = db.query(AutomationRun).filter(AutomationRun.id == run_id).first()
    print("\n=== Final Run State ===")
    print(f"ID: {completed_run.id}")
    print(f"Status: {completed_run.status}")
    print(f"Jobs Found: {completed_run.jobs_found}")
    print(f"Jobs Processed: {completed_run.jobs_processed}")
    print(f"Applications Submitted: {completed_run.applications_submitted}")
    print(f"Applications Skipped: {completed_run.applications_skipped}")
    print(f"Applications Failed: {completed_run.applications_failed}")
    print(f"Error Message: {completed_run.error_message}")
    
    logs = (
        db.query(AutomationLog)
        .filter(AutomationLog.run_id == run_id)
        .order_by(AutomationLog.created_at.asc())
        .all()
    )
    print(f"\n=== Event Log Sequence ({len(logs)} events) ===")
    for log in logs:
        print(f"[{log.created_at}] [{log.level.upper()}] {log.event}: {log.message} | meta={log.metadata_json}")
    db.close()

if __name__ == "__main__":
    asyncio.run(main())
