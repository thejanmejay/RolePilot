-- Migration: 002_add_onboarding_fields.sql
-- Description: Add onboarding completion status and profile headline/target_role fields to public.profiles.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS headline TEXT,
    ADD COLUMN IF NOT EXISTS target_role TEXT,
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
    ON public.profiles(onboarding_completed);

-- Mark existing users who have already populated their profiles as onboarded
UPDATE public.profiles
SET onboarding_completed = TRUE,
    onboarding_completed_at = now()
WHERE first_name IS NOT NULL 
  AND first_name != 'Candidate' 
  AND onboarding_completed = FALSE;
