# RolePilot — Engineering System & Project Instructions

This document defines the core architecture, engineering principles, safety protocols, and operational workflows for RolePilot. All agents and engineers working in this repository must adhere to these instructions.

---

## 1. Product Purpose & Architecture

RolePilot is an intelligent job-search and application automation platform designed to empower job-seekers with automated job discovery, personalized application assistance, profile readiness scoring, resume parsing, and multi-platform automation runs.

### Confirmed Technology Stack
- **Frontend**:
  - React 19.2 + TypeScript + Vite 8.3.
  - Vanilla CSS design system powered by RolePilot SaaS design tokens in [frontend/src/index.css](file:///Users/janamjay/linkedin/frontend/src/index.css).
  - Component library in [frontend/src/components/common/](file:///Users/janamjay/linkedin/frontend/src/components/common/) (`Button`, `Input`, `Card`, `Badge`, `Alert`, `Modal`, `ProgressBar`, `LoadingSpinner`, `ProcessingState`).
  - Linting: `oxlint`.
- **Backend**:
  - Python 3.11 + FastAPI + Pydantic v2 + SQLAlchemy 2.0.
  - SQLite/PostgreSQL persistence with Supabase Auth integration.
  - Browser Automation: Playwright (`chromium`) with headless execution and diagnostic telemetry.
  - Durable background queue for automation tasks in [backend/app/workers/linkedin_worker.py](file:///Users/janamjay/linkedin/backend/app/workers/linkedin_worker.py).
  - Virtual environment: `linkedin-hunter/.venv`.

---

## 2. Non-Negotiable Safety & Security Protocols

### A. The Triple-Key Live-Submission Safety Guard
RolePilot protects job seekers from unintentional job application submissions through a mandatory, three-part hardware/software interlock:
1. `dry_run` must be explicitly set to `False`.
2. `allow_live_submission` must be explicitly set to `True`.
3. `live_submission_confirmation` must strictly match the sentinel string `"CONFIRM_REAL_SUBMISSION"`.

**Rule**: Unless ALL THREE keys are satisfied simultaneously, every automation run MUST execute strictly in simulated/dry-run mode. During automated testing or local development, **NEVER submit real applications**.

### B. Candidate Data Privacy & Isolation
- User scoping is mandatory: every authenticated endpoint must enforce `user_id = Depends(get_current_user_id)`.
- Never expose or log sensitive credentials, session tokens (`li_at` cookies), or unencrypted personal resumes.
- User data is never used for external AI model training without separate, explicit consent.
- Resumes and portfolio extractions must be kept strictly isolated per user account.

### C. SSRF & Network Protections
- All public URL extractions (e.g. portfolios, websites) must pass through `validate_safe_url` in [portfolio_extractor.py](file:///Users/janamjay/linkedin/backend/app/services/portfolio_extractor.py).
- Disallow private, loopback (`127.0.0.1`), link-local (`169.254.169.254`), multicast, and reserved IP ranges via DNS resolution check.
- Enforce strict size limits ($2\text{ MB}$ cap) and request timeouts ($8\text{s}$) on all external HTTP requests.

### D. Zero-Deployment Constraint
- **Do NOT deploy to production, alter remote databases, or trigger cloud releases without explicit, written authorization from the user.**

---

## 3. Verified Verification & Testing Commands

Always run these commands locally before marking any task as complete:

| Scope | Command | Purpose |
|---|---|---|
| **Frontend Node Tests** | `node --test tests/*.mjs` | Runs the 90+ comprehensive UI, contract, lifecycle, and design-system tests |
| **Frontend Linter** | `npm --prefix frontend run lint` | Fast static analysis via oxlint across 130+ files |
| **Frontend Production Build** | `npm --prefix frontend run build` | Validates TypeScript compilation (`tsc -b`) and Vite production bundle |
| **Backend Pytest** | `source linkedin-hunter/.venv/bin/activate && PYTHONPATH=.:src pytest tests/test_*.py` | Validates extraction services, durable queues, diagnostics, policy, and sessions |

---

## 4. Engineering Principles & Definition of Done

1. **Evidence-Based Reporting**: Never claim a test passed, a bug was fixed, or a build succeeded without executing the verified command and observing the output.
2. **Inspect First**: Always inspect existing schemas, components, and endpoints before writing code. Do not invent duplicate schemas or ungrounded APIs.
3. **No Guessing Preferences**: Do not guess candidate compensation expectations, relocation willingness, or notice period during resume parsing or portfolio extraction.
4. **Responsive & Accessible by Default**:
   - Verify views at 375px (mobile), 768px (tablet), 1024px (laptop), and 1440px (desktop).
   - Ensure semantic ARIA roles (`role="progressbar"`, `role="status"`, `role="dialog"`) and screen-reader support.
   - Respect `prefers-reduced-motion`.
5. **Progressive Disclosure**:
   - Maintain concise documentation. Specialized runbooks and engineering procedures are located in the `.agents/skills/` directory.

---

## 5. Specialized Engineering Skills Directory

Detailed project skills are maintained in `.agents/skills/` and are automatically discoverable:
- [rolepilot-pm](file:///.agents/skills/rolepilot-pm/SKILL.md): Requirements breakdown, scope control, and acceptance criteria.
- [rolepilot-architecture](file:///.agents/skills/rolepilot-architecture/SKILL.md): System contracts, API schemas, and platform adapters.
- [rolepilot-frontend-ux](file:///.agents/skills/rolepilot-frontend-ux/SKILL.md): SaaS design tokens, responsive layouts, accessibility, and loading UI.
- [rolepilot-backend-engineer](file:///.agents/skills/rolepilot-backend-engineer/SKILL.md): FastAPI services, background workers, and persistence.
- [rolepilot-sdet](file:///.agents/skills/rolepilot-sdet/SKILL.md): Node and Python testing strategies, test isolation, and mocks.
- [rolepilot-security](file:///.agents/skills/rolepilot-security/SKILL.md): Triple-Key guard, SSRF defenses, and authentication rules.
- [rolepilot-maintenance](file:///.agents/skills/rolepilot-maintenance/SKILL.md): Preventing documentation drift and code hygiene.

---

## 6. Product Authenticity and UI Copy

- Use RolePilot's existing design tokens, typography, and shared components before adding new visual styles.
- Keep product copy concise, specific, and truthful. Do not invent metrics, testimonials, job listings, extension availability, security claims, or application outcomes.
- Avoid decorative emojis, AI-themed symbols, gratuitous gradients, excess card layouts, and unnecessary animation. Use icons only when they improve comprehension.
- Do not use double hyphens as separators or excessive em dashes. Keep button labels and terminology consistent.
- Show honest loading, empty, error, and recovery states. Distinguish dry runs from real submissions and preserve the user's review and confirmation.
- Test responsive layouts and accessibility using semantic elements, keyboard focus, screen-reader labels, and reduced-motion preferences.
