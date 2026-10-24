# RolePilot

> **Your Career. Your Next Move.**  
> Discover opportunities, streamline applications, and manage your job search from one place.

RolePilot is a modern career platform and application assistant for job search and Easy Apply workflows. Built with **FastAPI**, **React/Vite**, **Supabase**, and **Playwright**, designed with strict validation, rate-limiting, humanized interactions, and safe form-filling heuristics.

---

## Key Features

- **Virtualized Search Collector:** Handles LinkedIn's continuous dynamic scrolling and virtualized DOM cards (`div.jobs-search-results-list`) to reliably discover and deduplicate job pools.
- **Strict Option & Form Matching:**
  - Exact normalized string matching.
  - Number-in-label matching (`"9"` $\to$ `"9 months"`, `"10"` $\to$ `"10 months"`, `"0"` $\to$ `"0 month"`).
  - Positional 1-based index fallback for non-numeric lists.
  - Multi-language support (English, Spanish, Portuguese, French, German).
- **Intelligent Question Routing:**
  - Distinguishes overall professional experience (years + additional months) from skill-specific tenure.
  - Canonical notice period mapping (`notice_period_days`) and automatic immediate-joiner consistency (`No`).
  - Differentiates generic Yes/No queries from open-ended tool requests (e.g. Postman for API testing).
  - Automatically maps portfolio and GitHub questions to configured profiles.
- **Safety & Rate Limiting:**
  - **Dry-Run Mode (`--dry-run`):** Walks through entire multi-step modals without clicking final submission.
  - **Token Bucket Rate Limiter:** Enforces configurable delays, session limits, burst control, and mandatory breaks.
  - **Humanized Interaction:** Variable typing delays, cursor jiggling, smooth scrolling, and stealth plugins.
  - **Interactive User Prompter:** Displays non-blocking, timed terminal prompts with visual alerts when encountering unknown required fields instead of guessing.
- **External ATS Detection:** Detects and routes external job links (e.g. Workday multi-page wizards).
- **SQLite Activity & Application Tracking:** Records application status (`applied`, `already_applied`, `skipped`, `failed`, `blacklisted`) with full audit history.

---

## Architecture Overview

```
linkedin-hunter/
├── src/linkedin_hunter/
│   ├── auth/           # Session management & cookie persistence
│   ├── browser/        # Playwright engine, stealth configuration, humanized delays
│   ├── db/             # SQLite repository & schema definitions
│   ├── forms/          # Modal field detector, strict matcher, prompter, memory
│   ├── jobs/           # Search URL filters, virtual DOM parser, multi-step apply runner
│   ├── tracker/        # Application limits, blacklist filter, statistics
│   ├── workday/        # External Workday ATS detector & wizard filler
│   ├── cli.py          # Click CLI entrypoint
│   └── config.py       # Pydantic configuration schema & loader
├── tests/              # Pytest regression suite
├── config.yaml         # User profile, search filters, and custom answer rules
└── pyproject.toml      # Build metadata & dependencies
```

---

## Installation & Setup

### 1. Prerequisites
- Python 3.11+
- Virtual environment tool (`venv`)

### 2. Clone & Setup Virtual Environment
```bash
git clone git@github-thejanmejay:thejanmejay/linkedin-hunter-v2.git
cd linkedin-hunter-v2

python3 -m venv .venv
source .venv/bin/activate
pip install -e .
playwright install chromium
```

---

## Configuration (`config.yaml`)

Create or update your [`config.yaml`](file:///Users/janamjay/linkedin/linkedin-hunter/config.yaml) in the project root:

```yaml
profile:
  first_name: "Janmejay"
  last_name: "Singh"
  email: "your-email@example.com"
  phone: "+91 9123456789"
  city: "Noida"
  state: "Uttar Pradesh"
  country: "India"
  linkedin_url: "https://www.linkedin.com/in/yourprofile"
  github_url: "https://github.com/yourhandle"
  years_of_experience: 1
  months_of_experience: 10
  notice_period_days: 30
  resume_path: "resumes/resume.pdf"

search:
  keywords: '"Software Test Engineer" OR "QA Automation Engineer" OR "SDET"'
  location: "India"
  distance: 50
  experience_level: "entry,associate"  # Generates f_E=2,3
  date_posted: "past-week"
  easy_apply_only: true
  max_jobs: 50

apply:
  limit: 25
  daily_limit: 25
  delay_min: 3
  delay_max: 8
  break_after: 10
  break_duration: 120
  blacklist_title:
    - "Manager"
    - "Director"
    - "Lead"
    - "Principal"
```

---

## CLI Usage

### Authenticate
Launches browser to log in and save cookies to `data/cookies.json`:
```bash
linkedin-hunter login
```

### Dry Run Application (Recommended before live runs)
Performs complete search, classification, and fills all modal fields up to the final submit step:
```bash
linkedin-hunter apply --dry-run
```

### Live Applications
Submits Easy Apply forms within configured limits:
```bash
linkedin-hunter apply --limit 15
```

### Search Only
Scrapes and parses available jobs into the local database without applying:
```bash
linkedin-hunter search --keywords "SDET" --location "India"
```

### Check Statistics
Displays session history, daily counts, and application success rates:
```bash
linkedin-hunter status
```

---

## Continuous Integration (CI)

A GitHub Actions CI workflow is configured in [`.github/workflows/ci.yml`](file:///Users/janamjay/linkedin/.github/workflows/ci.yml).

### Triggers
- **Pushes** to `main`
- **Pull Requests** targeting `main`
- **Manual Trigger** (`workflow_dispatch`)

### CI Jobs & Local Reproduction
1. **Frontend Job** (`frontend`):
   - Sets up Node.js 22 and caches npm packages via `frontend/package-lock.json`.
   - Runs `oxlint` linter and strict TypeScript typechecking + Vite production bundle build.
   - Executes the TypeScript Application Readiness Engine unit test suite.
   - **Local command:**
     ```bash
     npm --prefix frontend ci
     npm --prefix frontend run lint
     npm --prefix frontend run build
     node --experimental-strip-types tests/test_readiness_engine.ts
     ```

2. **Backend Job** (`backend`):
   - Sets up Python 3.12 and installs dependencies from `requirements.txt`.
   - Runs unit, FastAPI API, and multi-tenant security isolation tests against an in-memory SQLite database (`DATABASE_URL=sqlite:///:memory:`).
   - **Local command:**
     ```bash
     PYTHONPATH=.:src pytest tests/test_backend.py tests/test_fixes.py tests/test_profile_readiness_flow.py -v
     ```

3. **Playwright Safety Job** (`playwright`):
   - Installs Playwright browser binaries with system dependencies (`chromium`).
   - Executes form detection, step telemetry, and Triple-Key safety guard tests in mock/dry-run mode (`DRY_RUN=true`, `ALLOW_LIVE_SUBMISSION=false`).
   - Real LinkedIn credentials are never required or utilized in CI.
   - **Local command:**
     ```bash
     PYTHONPATH=.:src pytest tests/test_playwright_apply.py -v
     ```

### Secrets Configuration
- **No GitHub repository secrets are required** to run this pipeline. All backend and browser tests are fully isolated and utilize in-memory mock environments and synthetic JWT signatures.

---

## Running Tests

Execute the full regression test suite:
```bash
./.venv/bin/pytest tests/ -vv
```

---

## Safety & Disclaimer

This automation tool is designed for personal productivity and job hunting efficiency. Always review and customize your answers in `config.yaml` to ensure all submitted details are accurate, truthful, and representative of your professional experience.

## To install .requirement.txt
pip install -r requirements.txt
playwright install chromium
