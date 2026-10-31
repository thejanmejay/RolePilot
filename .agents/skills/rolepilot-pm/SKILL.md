---
name: rolepilot-pm
description: >-
  Coordinates RolePilot project management, feature breakdowns, user stories, scope control,
  and acceptance criteria validation. Activate this skill when planning new features, scoping tasks,
  or defining acceptance criteria before implementation.
---

# RolePilot — Project Management & Requirements Skill

This skill defines the workflow for scoping, breaking down, and tracking engineering tasks in RolePilot without scope creep or ungrounded assumptions.

## 1. Activation Conditions
Activate this skill when:
- Receiving a new multi-phase feature request or roadmap epic.
- Clarifying requirements, acceptance criteria, or definition of done.
- Triaging bugs, edge cases, and user flow regressions.
- Aligning changes across frontend, backend, security, and testing boundaries.

## 2. Required Inspection Steps
Before proposing or executing an implementation plan:
1. **Audit Existing Architecture**: Inspect existing database schemas ([backend/app/db/models/](file:///Users/janamjay/linkedin/backend/app/db/models/)), API schemas ([backend/app/schemas/](file:///Users/janamjay/linkedin/backend/app/schemas/)), and frontend types ([frontend/src/types/](file:///Users/janamjay/linkedin/frontend/src/types/)).
2. **Review Current Git Status**: Check modified and untracked files (`git status`) to avoid conflicting with in-progress branches.
3. **Check Test Baselines**: Confirm that the existing test suites (`node --test tests/*.mjs` and `pytest`) are passing before introducing modifications.

## 3. Decision Rules & Scope Boundaries
- **No Invented APIs**: Never plan endpoints or database columns that are not substantiated by existing code or explicitly requested.
- **Safety First**: Features involving job applications must preserve the Triple-Key Live-Submission Guard (`dry_run=False`, `allow_live_submission=True`, `live_submission_confirmation="CONFIRM_REAL_SUBMISSION"`).
- **Free-Forever Features**: Marketing website tools (e.g. ATS Resume Checker) must never require a paid gate or mandatory account creation for core features.
- **Progressive Delivery**: Plan work in discrete, reviewable stages (e.g. Phase 1 Inspection, Phase 2 Core Engine, Phase 3 UI Integration, Phase 4 Tests).

## 4. Implementation Workflow
1. **Scope Definition**: Break down requirements into numbered phases with clear input/output contracts.
2. **Dependency Mapping**: Identify affected files, schemas, endpoints, and UI components.
3. **Quality Gates**: For each phase, declare exact acceptance criteria, automated tests to add, and failure recovery behaviors.
4. **Execution Tracking**: Keep execution grounded in evidence. Record real command outputs at each stage.

## 5. Verification & Acceptance Criteria
A task or phase is complete only when:
- All stated user stories and edge cases have verified implementations.
- No unrelated code or dependencies have been modified.
- Full test suites pass with zero regressions.
- The user is provided with an evidence-based report distinguishing local tests from production observations.

## 6. Final Report Format
When concluding a PM/scoping milestone, report:
- Confirmed findings and scope boundaries.
- Discrete implementation stages completed.
- Acceptance criteria verified with exact test outcomes.
- Any deferred or follow-up items clearly documented.
