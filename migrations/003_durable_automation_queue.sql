-- Migration: 003_durable_automation_queue.sql
-- Description: Add durable queue fields and indexes to automation_runs for atomic claiming, heartbeats, idempotency, and recovery.

ALTER TABLE public.automation_runs
    ADD COLUMN IF NOT EXISTS worker_id TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS allow_live_submission BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS live_submission_confirmation TEXT,
    ADD COLUMN IF NOT EXISTS max_jobs INTEGER NOT NULL DEFAULT 10;

-- Index for queue claiming (pending runs ordered by creation)
CREATE INDEX IF NOT EXISTS idx_automation_runs_queue 
    ON public.automation_runs (created_at ASC) 
    WHERE status IN ('pending', 'queued');

-- Index for heartbeat & stale lease monitoring
CREATE INDEX IF NOT EXISTS idx_automation_runs_stale_leases 
    ON public.automation_runs (heartbeat_at) 
    WHERE status = 'running';

-- Index for user idempotency lookups
CREATE INDEX IF NOT EXISTS idx_automation_runs_idempotency 
    ON public.automation_runs (user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
