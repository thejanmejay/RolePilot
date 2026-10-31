-- User-scoped LinkedIn extraction records and durable exact-run selections.
CREATE TABLE IF NOT EXISTS public.synced_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
    linkedin_job_id TEXT NOT NULL,
    listing_url TEXT NOT NULL,
    title TEXT NULL,
    company TEXT NULL,
    location TEXT NULL,
    description TEXT NULL,
    workplace_type TEXT NULL,
    employment_type TEXT NULL,
    experience_level TEXT NULL,
    is_easy_apply BOOLEAN NULL,
    source_platform TEXT NOT NULL DEFAULT 'linkedin',
    source_page_url TEXT NOT NULL,
    observation_count INTEGER NOT NULL DEFAULT 1,
    first_extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_synced_jobs_user_listing UNIQUE (user_id, linkedin_job_id)
);
CREATE INDEX IF NOT EXISTS ix_synced_jobs_user_id ON public.synced_jobs(user_id);
CREATE INDEX IF NOT EXISTS ix_synced_jobs_job_id ON public.synced_jobs(job_id);
CREATE INDEX IF NOT EXISTS ix_synced_jobs_linkedin_job_id ON public.synced_jobs(linkedin_job_id);

ALTER TABLE public.automation_runs
    ADD COLUMN IF NOT EXISTS selected_synced_job_ids JSONB NULL,
    ADD COLUMN IF NOT EXISTS resume_id UUID NULL REFERENCES public.resumes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT FALSE;
