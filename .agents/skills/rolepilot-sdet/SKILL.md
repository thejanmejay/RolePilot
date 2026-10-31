---
name: rolepilot-sdet
description: >-
  Directs RolePilot quality engineering, automated test authoring, regression prevention,
  and SDET verification across Node.js integration tests and Python pytest suites.
  Activate this skill when writing tests, debugging test failures, or validating quality gates.
---

# RolePilot — SDET & Regression Verification Skill

This skill governs test architecture, automated verification, regression suites, and continuous quality checks across the RolePilot repository.

## 1. Activation Conditions
Activate this skill when:
- Authoring new test files or adding test cases for features and bug fixes.
- Investigating, triaging, or resolving test failures.
- Designing mock strategies for external services (Supabase, LinkedIn, Playwright).
- Validating regressions before concluding engineering milestones.

## 2. Required Inspection Steps
1. **Existing Node Test Suite**: Inspect files in [tests/](file:///Users/janamjay/linkedin/tests/) ending in `.mjs` (`test_responsive_ui_and_design_system.mjs`, `test_smart_onboarding_and_loading.mjs`, `test_multi_platform_and_readiness.mjs`, etc.).
2. **Existing Pytest Suite**: Inspect Python test files in [tests/](file:///Users/janamjay/linkedin/tests/) (`test_profile_extraction_service.py`, `test_durable_queue_and_reliability.py`, `test_playwright_render_diagnostics.py`, `test_policy.py`, `test_linkedin_session.py`).
3. **Mock Conventions**: Check [tests/conftest.py](file:///Users/janamjay/linkedin/tests/conftest.py) for fixtures and mock database sessions.

## 3. Decision Rules & Testing Principles
- **Zero Real Application Submissions**:
  - Tests must NEVER trigger a real live job application on any platform.
  - Verify that the Triple-Key Submission Guard enforces simulated / dry-run mode when any key is missing.
- **Hermetic & Independent Tests**:
  - Tests must not depend on external live networks, active internet connections, or cloud environments.
  - Mock external HTTP requests, Playwright browser instances, and Supabase auth callbacks.
- **Evidence-Based Assertions**:
  - Do not write trivial or vacuous assertions (e.g. asserting `true == true`).
  - Assert on concrete state changes, HTML element attributes (`role`, `aria-*`, `id`), HTTP response payloads, and database records.
- **Fail Fast & Clear Error Messages**:
  - Provide descriptive assertion failure messages that pinpoint the broken requirement or missing token.

## 4. Implementation Workflow
1. **Node Test Authoring (`*.mjs`)**:
   - Use Node's built-in `node:test` and `node:assert`.
   - Read source files and component markup to assert design token adherence, accessibility attributes, and contract bindings.
   - Run via:
     ```bash
     node --test tests/<test_file>.mjs
     ```
2. **Python Test Authoring (`test_*.py`)**:
   - Use `pytest` with `pytest-asyncio` and `unittest.mock`.
   - Test service business logic, SSRF protections, edge cases (malformed PDFs, scanned unreadable documents, DNS failures).
   - Run via:
     ```bash
     source linkedin-hunter/.venv/bin/activate && PYTHONPATH=.:src pytest tests/<test_file>.py
     ```
3. **Full Regression Execution**:
   - Always run the complete Node suite and Python suite before finalizing changes.

## 5. Verification & Acceptance Criteria
- All 90+ Node.js tests pass: `node --test tests/*.mjs` -> $0$ failures.
- All Python pytest tests pass: `PYTHONPATH=.:src pytest tests/test_*.py` -> $0$ failures.
- Frontend linter passes: `npm --prefix frontend run lint` -> $0$ errors.
- Frontend build passes: `npm --prefix frontend run build` -> clean build without TypeScript errors.

## 6. Final Report Format
Document:
- Tests added or updated.
- Exact commands executed and raw terminal output statistics (e.g., `tests 92, pass 92, fail 0`).
- Edge cases and failure conditions validated.
- Confirmation of zero live submissions.
