---
name: rolepilot-maintenance
description: >-
  Coordinates RolePilot repository hygiene, documentation consistency, documentation drift prevention,
  dependency health, and frontend bundle size monitoring. Activate this skill when auditing documentation,
  cleaning up technical debt, analyzing bundle growth, or syncing engineering runbooks.
---

# RolePilot — Cross-Cutting Maintenance & Documentation Consistency Skill

This skill ensures repository health, code cleanliness, bundle size optimization, and alignment between implementation and project documentation.

## 1. Activation Conditions
Activate this skill when:
- Auditing documentation for accuracy or updating architecture runbooks.
- Preventing documentation drift after adding or modifying APIs, schemas, or features.
- Analyzing frontend bundle size growth, vendor dependencies, or build chunking.
- Cleaning up temporary files, orphaned fixtures, or unused imports.
- Reviewing Git status and diffs across branches before commits.

## 2. Required Inspection Steps
1. **Core Instructions**: Inspect [AGENTS.md](file:///Users/janamjay/linkedin/AGENTS.md) and verify that all referenced paths, commands, and rules are current.
2. **Specialized Skills**: Review the skills in [.agents/skills/](file:///Users/janamjay/linkedin/.agents/skills/) to ensure they reflect current architecture without duplicate or conflicting guidelines.
3. **Frontend Bundle Output**: Run `npm --prefix frontend run build` to inspect output chunk sizes and gzip metrics.
4. **Git Diff Audit**: Run `git status -s` and `git diff --stat` to detect unintended modifications or extraneous files.

## 3. Decision Rules & Hygiene Principles
- **Prevent Documentation Drift**:
  - Whenever an API endpoint, database schema, design token, or test command is changed, immediately update `AGENTS.md` and the corresponding skill files.
  - Never allow documented commands or paths to become stale.
- **Evidence-Based Updates**:
  - Do not rewrite or modify skills for routine bug fixes that do not alter engineering rules.
  - Never fabricate metrics, test output, or production status in documentation.
- **Bundle Size Discipline**:
  - Keep individual bundle chunks under $500\text{ kB}$ whenever feasible using `manualChunks` in [frontend/vite.config.ts](file:///Users/janamjay/linkedin/frontend/vite.config.ts).
  - Avoid importing whole icon sets or heavy libraries when only small subsets are used.
- **Clean Workspace**:
  - Never commit transient scratch files, Python bytecode (`__pycache__`), or personal environment files (`.env`).
  - Keep untracked files clean and organized.

## 4. Implementation Workflow
1. **Impact Analysis**: Identify which documentation, skills, or runbooks are affected by recent code changes.
2. **Synchronized Updates**: Update documentation in the same review milestone as the code change.
3. **Static Analysis & Build Check**:
   - Run linter: `npm --prefix frontend run lint`.
   - Run production build: `npm --prefix frontend run build`.
4. **Diff Verification**: Ensure all diffs are intentional, necessary, and strictly within scope.

## 5. Verification & Acceptance Criteria
- All paths referenced in `AGENTS.md` and `.agents/skills/` point to valid existing files.
- Linter reports zero errors: `npm --prefix frontend run lint` -> $0$ errors.
- Build succeeds without warnings or broken imports.
- Node test suite and pytest suite pass with zero regressions.

## 6. Final Report Format
Document:
- Documentation and skill files audited or updated.
- Bundle size metrics and chunk distributions.
- Cleanliness verification (`git status` and lint output).
- Verified commands and test suite results.
