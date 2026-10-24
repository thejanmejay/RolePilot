-- Migration: 001_create_user_policy_acceptances.sql
-- Description: Create user_policy_acceptances table for mandatory consent tracking and policy version auditing.

CREATE TABLE IF NOT EXISTS public.user_policy_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_type TEXT NOT NULL DEFAULT 'platform_terms',
    policy_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_policy_acceptances_user_type_version UNIQUE (user_id, policy_type, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_user_policy_acceptances_user_id 
    ON public.user_policy_acceptances(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_policy_acceptances ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their own policy acceptances
CREATE POLICY "Users can view own policy acceptances"
    ON public.user_policy_acceptances
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow authenticated users to record their own acceptance
CREATE POLICY "Users can insert own policy acceptances"
    ON public.user_policy_acceptances
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
