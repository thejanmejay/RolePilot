# RolePilot — Production & Staging Deployment Runbook

This guide covers the staging and production deployment procedures for RolePilot on **Render** (FastAPI Web API + Durable Queue Worker), **Supabase** (PostgreSQL + Auth + Storage), and **Vercel** (React Frontend).

---

## 1. Environment Configuration

### Required Environment Variables

| Variable | Target Services | Description / Generation |
| :--- | :--- | :--- |
| `SESSION_ENCRYPTION_KEY` | Render API & Worker | **Strict Requirement in Production ($\ge 32$ chars)**.<br>Generate with: `openssl rand -base64 32`<br>Encrypts LinkedIn session cookies using authenticated Fernet (AES-128-CBC + HMAC-SHA256). |
| `DATABASE_URL` | Render API & Worker | Supabase PostgreSQL Connection Pooler URI (`postgresql+psycopg://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require`). |
| `SUPABASE_URL` | Render API & Worker | Supabase project API URL (`https://[PROJECT-ID].supabase.co`). |
| `SUPABASE_ANON_KEY` | Render API & Worker | Supabase project anonymous public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Render API & Worker | Supabase service-role administrative secret for storage management and account deletion. |
| `SUPABASE_JWT_SECRET` | Render API & Worker | Secret used to verify candidate Bearer JWTs. |
| `ENVIRONMENT` | Render API & Worker | Set to `production` or `staging`. When `production`, missing or short encryption keys fail startup immediately. |
| `FRONTEND_ORIGIN` | Render API & Worker | Production frontend URL (`https://rolepilot-frontend-phi.vercel.app`). |

---

## 2. Database Migrations (Supabase)

Execute migrations in the Supabase SQL Editor in numerical order:

1. [`migrations/001_create_user_policy_acceptances.sql`](file:///Users/janamjay/linkedin/migrations/001_create_user_policy_acceptances.sql): Platform policy and consent tracking.
2. [`migrations/002_add_onboarding_fields.sql`](file:///Users/janamjay/linkedin/migrations/002_add_onboarding_fields.sql): Candidate profile and onboarding fields.
3. [`migrations/003_durable_automation_queue.sql`](file:///Users/janamjay/linkedin/migrations/003_durable_automation_queue.sql): Adds durable queue fields (`worker_id`, `locked_at`, `heartbeat_at`, `attempt_count`, `max_attempts`, `idempotency_key`, `allow_live_submission`) and queue indexes.

---

## 3. Render Deployment Setup

RolePilot separates the public API web process from durable automation execution. Both services share the same codebase and database.

### Option A: Automatic Blueprint Deploy via `render.yaml`
The repository includes [`render.yaml`](file:///Users/janamjay/linkedin/render.yaml). In Render:
1. Navigate to **Blueprints** $\to$ **New Blueprint Instance**.
2. Select repository `thejanmejay/RolePilot` (or branch `feature/password-recovery-landing-polish`).
3. Render automatically provisions:
   - **`rolepilot-api`** (Web Service): Starts `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`.
   - **`rolepilot-queue-worker`** (Background Worker): Starts `python -m backend.app.workers.queue_worker`.
4. Enter the required secrets (`SESSION_ENCRYPTION_KEY`, `DATABASE_URL`, `SUPABASE_*`).

### Option B: Manual Service Configuration in Render Dashboard

#### Web Service (`rolepilot-api`)
- **Environment:** Python
- **Build Command:** `./scripts/render_build.sh` *(Installs dependencies and `playwright install --with-deps chromium`)*
- **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- **Plan:** Starter (minimum 512MB RAM)
- **Health Check Path:** `/health`

#### Worker Service (`rolepilot-queue-worker`)
- **Environment:** Python (Background Worker)
- **Build Command:** `./scripts/render_build.sh`
- **Start Command:** `python -m backend.app.workers.queue_worker`
- **Plan:** Starter (minimum 512MB RAM)

---

## 4. Diagnostics & Smoke Testing

### 1. Browser & Encryption Diagnostics Endpoint
After deployment, query the diagnostics endpoint:
```bash
curl -s https://rolepilot-api.onrender.com/health/diagnostics | jq .
```
Expected response:
```json
{
  "status": "healthy",
  "service": "rolepilot-api",
  "environment": "production",
  "database": "ok",
  "session_encryption": {
    "configured": true,
    "required_in_production": true
  },
  "browser_engine": {
    "available": true,
    "browser": "chromium",
    "status": "ready",
    "message": "Chromium headless browser engine is installed and operational."
  }
}
```

### 2. Standalone Worker Single-Run Smoke Test
Test the worker without looping:
```bash
python -m backend.app.workers.queue_worker --once
```

---

## 5. Operational Procedures & Runbook

### Handling Stale Leases & Ambiguous Runs (`needs_reconciliation`)
- The `QueueService` automatically checks for crashed workers every time a run is claimed.
- If a worker crashes during a **dry-run** discovery step, the run is safely requeued for retry up to `max_attempts` (default: 3).
- If a worker crashes or times out while **live submission is enabled** or after applications were submitted, the run is transitioned to **`needs_reconciliation`**.
  - **Reason:** To prevent submitting duplicate job applications on LinkedIn.
  - **Reconciliation Action:** An administrator or candidate inspects the run logs via `GET /api/v1/automation/runs/{id}/logs`. If the application was already submitted on LinkedIn, mark the application as `submitted`. If not, the candidate can trigger a new run.

### Key Rotation Protocol
If `SESSION_ENCRYPTION_KEY` must be rotated:
1. Keep the old key available.
2. Run a migration script that reads all rows in `linkedin_accounts` where `encrypted_session IS NOT NULL`, decrypts with the old key, and re-encrypts with the new key.
3. Update `SESSION_ENCRYPTION_KEY` in the Render environment variables.
4. Redeploy the services.
