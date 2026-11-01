-- ============================================================================
-- Rollback for Migration 011: Interview Preparation Tables
-- Author: RolePilot Architecture Team
-- Dependencies strictly removed in topological order without unnecessary CASCADE
-- ============================================================================

BEGIN;

-- 1. Drop triggers and functions on interview_answers before dropping table
DROP TRIGGER IF EXISTS trg_protect_completed_session_answers ON public.interview_answers;
DROP FUNCTION IF EXISTS protect_completed_session_answers();

-- Drop child table answers (explicit RESTRICT)
DROP TABLE IF EXISTS public.interview_answers RESTRICT;

-- 2. Drop triggers and functions on interview_session_items before dropping table
DROP TRIGGER IF EXISTS trg_protect_completed_session_items ON public.interview_session_items;
DROP FUNCTION IF EXISTS protect_completed_session_items();

DROP TRIGGER IF EXISTS trg_enforce_question_snapshot_immutability ON public.interview_session_items;
DROP FUNCTION IF EXISTS enforce_question_snapshot_immutability();

DROP TRIGGER IF EXISTS trg_validate_session_item_question_active ON public.interview_session_items;
DROP FUNCTION IF EXISTS validate_session_item_question_active();

-- Drop child table session_items (explicit RESTRICT)
DROP TABLE IF EXISTS public.interview_session_items RESTRICT;

-- 3. Drop triggers and functions on interview_sessions before dropping table
DROP TRIGGER IF EXISTS trg_validate_interview_session_consistency ON public.interview_sessions;
DROP FUNCTION IF EXISTS validate_interview_session_consistency();

-- Drop parent table interview_sessions (explicit RESTRICT)
DROP TABLE IF EXISTS public.interview_sessions RESTRICT;

-- 4. Drop study plans and question bank (explicit RESTRICT)
DROP TABLE IF EXISTS public.interview_study_plans RESTRICT;
DROP TABLE IF EXISTS public.interview_question_bank RESTRICT;

-- 5. Drop composite unique constraint on job_match_analyses
ALTER TABLE public.job_match_analyses DROP CONSTRAINT IF EXISTS uq_job_match_analyses_id_user;

COMMIT;
