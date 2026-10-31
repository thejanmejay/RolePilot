---
name: rolepilot-backend-engineer
description: >-
  Coordinates RolePilot backend engineering, FastAPI endpoints, SQLAlchemy persistence,
  database transactions, background workers, durable queue processing, and Playwright execution.
  Activate this skill when creating or modifying backend APIs, services, workers, or database logic.
---

# RolePilot — Backend APIs, Persistence & Worker Reliability Skill

This skill defines standards for backend services, API endpoints, database transactions, background task queues, and browser automation engines in RolePilot.

## 1. Activation Conditions
Activate this skill when:
- Creating or updating FastAPI endpoints under [backend/app/api/](file:///Users/janamjay/linkedin/backend/app/api/).
- Writing service layer logic in [backend/app/services/](file:///Users/janamjay/linkedin/backend/app/services/).
- Working on the automation worker or durable queue in [backend/app/workers/linkedin_worker.py](file:///Users/janamjay/linkedin/backend/app/workers/linkedin_worker.py).
- Interacting with database models or session transactions in [backend/app/db/](file:///Users/janamjay/linkedin/backend/app/db/).
- Managing Playwright browser instances or diagnostics in [src/linkedin_hunter/browser/engine.py](file:///Users/janamjay/linkedin/src/linkedin_hunter/browser/engine.py) and [backend/app/services/browser_diagnostics.py](file:///Users/janamjay/linkedin/backend/app/services/browser_diagnostics.py).

## 2. Required Inspection Steps
1. **Existing Endpoints & Routers**: Review [backend/app/api/router.py](file:///Users/janamjay/linkedin/backend/app/api/router.py) to inspect mounted prefixes and dependency injections.
2. **Security & Authentication Dependencies**:
   - Authenticated user extraction: `get_current_user_id` from [backend/app/core/security.py](file:///Users/janamjay/linkedin/backend/app/core/security.py).
   - Mandatory policy checks: `require_policy_accepted` from [backend/app/api/policy.py](file:///Users/janamjay/linkedin/backend/app/api/policy.py).
3. **Database Session Handling**: Use `get_db` from [backend/app/db/database.py](file:///Users/janamjay/linkedin/backend/app/db/database.py). Ensure session scopes do not leak across asynchronous tasks.
4. **Worker Queue Status**: Check [backend/app/schemas/automation.py](file:///Users/janamjay/linkedin/backend/app/schemas/automation.py) for run state transitions (`pending`, `running`, `completed`, `failed`, `cancelled`).

## 3. Decision Rules & Reliability Constraints
- **Triple-Key Guard Enforcement**:
  - The worker MUST strictly verify `dry_run is False`, `allow_live_submission is True`, and `live_submission_confirmation == "CONFIRM_REAL_SUBMISSION"` before executing any submit action in Playwright.
  - If any key is missing or invalid, force `dry_run = True`.
- **User Isolation**:
  - Every database query for user assets (resumes, profiles, applications, runs, configs) must filter strictly by `user_id == current_user_id`.
  - Prevent cross-tenant data access or parameter tampering.
- **Durable Task Processing**:
  - Background tasks must handle unexpected termination or exceptions gracefully by marking the run state as `failed` with a sanitized error message.
  - Telemetry logs and error traces must never contain passwords, raw session cookies (`li_at`), or personal contact credentials.
- **Resource Cleanup**:
  - Browser contexts, temporary uploaded files, and streaming buffers must be deterministically closed and deleted in `finally:` blocks or context managers.
  - Avoid memory leaks from unbounded text caches or dangling Playwright processes.

## 4. Implementation Workflow
1. **Input Validation**: Define incoming payload with Pydantic v2 schemas; validate file extensions and size constraints prior to reading into memory.
2. **Service Layer Execution**: Encapsulate business logic in reusable service classes (e.g. `ResumeParser`, `ProfileService`, `BrowserDiagnosticsService`).
3. **Transactional Integrity**: Wrap state changes in database transactions. Commit only upon complete validation:
   ```python
   try:
       db.commit()
       db.refresh(instance)
   except Exception:
       db.rollback()
       raise
   ```
4. **Error Handling**: Raise explicit FastAPI `HTTPException` with proper HTTP status codes (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`).

## 5. Verification & Acceptance Criteria
- Run target pytest suites using the active virtual environment and Python path:
  ```bash
  source linkedin-hunter/.venv/bin/activate && PYTHONPATH=.:src pytest tests/test_*.py
  ```
- Verify zero database session leaks or orphaned browser processes.
- Ensure all new endpoints are documented in OpenAPI schemas.

## 6. Final Report Format
Document:
- Endpoints and services created or modified.
- Security dependencies and authorization checks applied.
- Worker queue reliability and state management behavior.
- Exact pytest test outputs and coverage.
