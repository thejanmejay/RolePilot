-- Snapshot temporary search criteria on the run without mutating saved preferences.
ALTER TABLE public.automation_runs
    ADD COLUMN IF NOT EXISTS search_overrides JSONB;
