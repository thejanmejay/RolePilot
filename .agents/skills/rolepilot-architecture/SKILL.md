---
name: rolepilot-architecture
description: >-
  Guides RolePilot system architecture, multi-platform adapter patterns, API contract design,
  state management, and asynchronous processing flows. Activate this skill when designing new services,
  refactoring data models, adding job platforms, or modifying core contracts.
---

# RolePilot — Architecture & Integration Design Skill

This skill governs the high-level system design, platform abstraction layers, database schemas, and service contracts in RolePilot.

## 1. Activation Conditions
Activate this skill when:
- Designing new API contracts, Pydantic schemas, or database tables.
- Adding or refactoring job platform adapters (LinkedIn, Indeed, Wellfound).
- Architecting asynchronous tasks, background workers, or event-driven pipelines.
- Establishing client-side state management patterns or caching layers.

## 2. Required Inspection Steps
1. **Platform Catalog & Contracts**: Inspect [frontend/src/types/platform.ts](file:///Users/janamjay/linkedin/frontend/src/types/platform.ts) for `PLATFORM_CATALOG`, platform status flags, and credential definitions.
2. **API & Schema Contracts**: Review [backend/app/schemas/](file:///Users/janamjay/linkedin/backend/app/schemas/) to ensure bidirectional alignment with TypeScript types in [frontend/src/types/](file:///Users/janamjay/linkedin/frontend/src/types/).
3. **Database Models & Migrations**: Inspect [backend/app/db/models/](file:///Users/janamjay/linkedin/backend/app/db/models/) to preserve relational integrity, foreign key cascades, and user isolation.
4. **API Router Registration**: Check [backend/app/api/router.py](file:///Users/janamjay/linkedin/backend/app/api/router.py) for route prefixing under `/api/v1`.

## 3. Decision Rules & Design Principles
- **Platform-Neutral Abstraction**:
  - Keep core domain models (Candidate, Application, Job, Run) independent of platform-specific quirks.
  - Platform-specific automation logic must reside in dedicated workers or adapters (e.g. `linkedin_worker.py`).
- **Pydantic v2 & Strong Typing**:
  - All request and response bodies must be modeled using Pydantic v2 schemas.
  - Avoid raw dictionaries in service layers.
- **Fail-Safe Asynchronous Execution**:
  - Long-running operations (Playwright navigation, multi-page parsing) must use background execution with durable status tracking (`pending` -> `running` -> `completed` / `failed`).
  - Never block the synchronous HTTP request loop on external network requests or browser launches.
- **Stateless & Resilient HTTP Clients**:
  - Set explicit timeouts and connection pools on HTTP clients (`httpx.AsyncClient`).
  - Cap response payload sizes to prevent memory exhaustion.

## 4. Implementation Workflow
1. **Contract Definition**: Define schema models in backend (`backend/app/schemas/`) and corresponding TypeScript interfaces in frontend (`frontend/src/types/`).
2. **Persistence Layer**: If new tables or columns are required, declare SQLAlchemy models with explicit indices and foreign keys referencing `users.id`.
3. **Service Layer**: Implement business logic in isolated services (`backend/app/services/`), keeping FastAPI route handlers lightweight.
4. **API Router Mounting**: Register endpoints in `backend/app/api/` and include in `api_v1_router`.
5. **Client Integration**: Create typed API methods in [frontend/src/api/](file:///Users/janamjay/linkedin/frontend/src/api/) with proper error formatting.

## 5. Verification & Acceptance Criteria
- All schemas serialize and deserialize cleanly without runtime validation errors.
- Database transactions use explicit `db.commit()` with safe rollback on error.
- Node contract tests pass (`test_multi_platform_and_readiness.mjs`).
- Pytest backend tests pass with zero regressions.

## 6. Final Report Format
Document:
- Entities, models, and interfaces added or updated.
- Platform adapter boundary points.
- Asynchronous reliability and timeout safeguards.
- Contract test results.
