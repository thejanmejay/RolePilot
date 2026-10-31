-- Migration: 002_create_email_reservations.sql
-- Description: Create email_reservations table to restrict registration of deleted account email identities.

CREATE TABLE IF NOT EXISTS public.email_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_email VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID,
    reason VARCHAR(100) NOT NULL DEFAULT 'account_deleted',
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_reservations_normalized_email
    ON public.email_reservations(normalized_email);

-- Enable Row Level Security (RLS)
ALTER TABLE public.email_reservations ENABLE ROW LEVEL SECURITY;

-- Deny all direct user modification: only trusted service role / backend admin can insert/read
CREATE POLICY "Service role full access on email_reservations"
    ON public.email_reservations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
