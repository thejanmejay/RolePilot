-- ============================================================================
-- Migration 011: Interview Preparation Question Bank, Sessions, and Rubrics
-- Author: RolePilot Architecture Team
-- Status: PLANNING & ISOLATED POSTGRESQL TESTING ONLY
-- Dependencies: public.profiles, public.resume_studio_documents, public.job_match_analyses
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Composite Unique Constraints on Referenced Parent Tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.job_match_analyses
  ADD CONSTRAINT uq_job_match_analyses_id_user UNIQUE (id, user_id);

-- ----------------------------------------------------------------------------
-- 2. Curated Question Bank with Question Key Versioning
-- Exactly one active version per logical question key enforced via partial index
-- ----------------------------------------------------------------------------
CREATE TABLE public.interview_question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_key VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    target_role VARCHAR(100) NOT NULL,
    skill_tag VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    expected_points_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    sample_answer TEXT,
    evaluation_criteria_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_qbank_key_version UNIQUE (question_key, version),
    CONSTRAINT chk_qbank_version_positive CHECK (version >= 1),
    CONSTRAINT chk_qbank_difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT chk_qbank_category CHECK (category IN (
        'technical', 'programming', 'automation_testing', 'framework', 
        'api_testing', 'database_sql', 'scenario', 'behavioral', 'hr', 'project_based'
    ))
);

-- Guarantees at most ONE active version per logical question
CREATE UNIQUE INDEX uq_qbank_key_active 
  ON public.interview_question_bank(question_key) 
  WHERE (is_active = true);

CREATE INDEX idx_interview_qbank_lookup 
  ON public.interview_question_bank(category, difficulty, skill_tag);

-- ----------------------------------------------------------------------------
-- 3. Practice & Mock Interview Sessions with Column-Specific SET NULL
-- ----------------------------------------------------------------------------
CREATE TABLE public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_document_id UUID,
    job_match_analysis_id UUID,
    session_type VARCHAR(30) NOT NULL,
    target_role VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    total_questions INTEGER NOT NULL,
    completed_questions INTEGER NOT NULL DEFAULT 0,
    overall_score NUMERIC(5, 2),
    score_breakdown JSONB,
    rubric_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_interview_sessions_id_user UNIQUE (id, user_id),
    CONSTRAINT fk_sessions_studio_doc FOREIGN KEY (resume_document_id, user_id) 
        REFERENCES public.resume_studio_documents(id, user_id) ON DELETE SET NULL (resume_document_id),
    CONSTRAINT fk_sessions_job_match FOREIGN KEY (job_match_analysis_id, user_id) 
        REFERENCES public.job_match_analyses(id, user_id) ON DELETE SET NULL (job_match_analysis_id),
    CONSTRAINT chk_session_type CHECK (session_type IN ('practice', 'mock_interview')),
    CONSTRAINT chk_session_difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT chk_session_status CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    CONSTRAINT chk_session_question_counts CHECK (
        total_questions >= 1 AND total_questions <= 50 AND
        completed_questions >= 0 AND completed_questions <= total_questions
    ),
    CONSTRAINT chk_overall_score_bounds CHECK (
        overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)
    )
);

CREATE INDEX idx_interview_sessions_user ON public.interview_sessions(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Session Items (Immutable Question Snapshots Preserving Historical Prompt)
-- ----------------------------------------------------------------------------
CREATE TABLE public.interview_session_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    question_bank_id UUID REFERENCES public.interview_question_bank(id) ON DELETE SET NULL,
    question_snapshot_json JSONB NOT NULL,
    sequence_order INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unanswered',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_interview_session_items_id_user UNIQUE (id, user_id),
    CONSTRAINT fk_session_items_session FOREIGN KEY (session_id, user_id) 
        REFERENCES public.interview_sessions(id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_session_sequence UNIQUE (session_id, sequence_order),
    CONSTRAINT chk_sequence_order CHECK (sequence_order >= 1),
    CONSTRAINT chk_item_status CHECK (status IN ('unanswered', 'answered', 'skipped'))
);

CREATE INDEX idx_interview_items_session ON public.interview_session_items(session_id, sequence_order);
CREATE INDEX idx_interview_items_user ON public.interview_session_items(user_id);

-- Enforce that only active questions can be selected for new session items
CREATE OR REPLACE FUNCTION validate_session_item_question_active()
RETURNS TRIGGER AS $$
DECLARE
  v_is_active BOOLEAN;
BEGIN
  IF NEW.question_bank_id IS NOT NULL THEN
    SELECT is_active INTO v_is_active
    FROM public.interview_question_bank
    WHERE id = NEW.question_bank_id
    FOR SHARE;

    IF v_is_active IS NULL THEN
      RAISE EXCEPTION 'Referenced question_bank_id % does not exist', NEW.question_bank_id;
    END IF;

    IF v_is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot add inactive question % to an interview session item', NEW.question_bank_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_session_item_question_active
  BEFORE INSERT ON public.interview_session_items
  FOR EACH ROW EXECUTE FUNCTION validate_session_item_question_active();

-- Enforce strict immutability of historical question snapshots
CREATE OR REPLACE FUNCTION enforce_question_snapshot_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.question_snapshot_json IS DISTINCT FROM OLD.question_snapshot_json THEN
    RAISE EXCEPTION 'interview_session_items.question_snapshot_json is immutable once created (item_id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_question_snapshot_immutability
  BEFORE UPDATE ON public.interview_session_items
  FOR EACH ROW EXECUTE FUNCTION enforce_question_snapshot_immutability();

-- Protect items from modification, addition, or deletion once parent session is completed
CREATE OR REPLACE FUNCTION protect_completed_session_items()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
  v_session_status VARCHAR(20);
BEGIN
  v_session_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;

  SELECT status INTO v_session_status
  FROM public.interview_sessions
  WHERE id = v_session_id
  FOR SHARE;

  IF v_session_status = 'completed' THEN
    RAISE EXCEPTION 'Cannot % session items on completed interview session %', TG_OP, v_session_id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_completed_session_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.interview_session_items
  FOR EACH ROW EXECUTE FUNCTION protect_completed_session_items();

-- ----------------------------------------------------------------------------
-- 5. Session Consistency Validation Trigger
-- Enforces transactional completion rules, item count matching, and score validation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_interview_session_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_actual_item_count INTEGER;
  v_answered_item_count INTEGER;
  v_unanswered_count INTEGER;
BEGIN
  -- Prevent inserting a session directly as completed
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot insert interview session directly as completed; session must be created in_progress and completed transactionally';
  END IF;

  -- Protect completed sessions against modifications
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    IF NEW.status != 'completed' THEN
      RAISE EXCEPTION 'Completed interview sessions are immutable and cannot be re-opened (session_id: %)', OLD.id;
    END IF;
    IF NEW.overall_score IS DISTINCT FROM OLD.overall_score THEN
      RAISE EXCEPTION 'Completed interview session overall_score cannot be modified (session_id: %)', OLD.id;
    END IF;
    IF NEW.total_questions IS DISTINCT FROM OLD.total_questions THEN
      RAISE EXCEPTION 'Completed interview session total_questions cannot be modified (session_id: %)', OLD.id;
    END IF;
  END IF;

  -- Validate transitioning to completed
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN
    -- Concurrency control: lock parent session row to serialize concurrent completions and mutations
    PERFORM id FROM public.interview_sessions WHERE id = NEW.id FOR UPDATE;

    SELECT COUNT(*) INTO v_actual_item_count
    FROM public.interview_session_items
    WHERE session_id = NEW.id;

    IF v_actual_item_count != NEW.total_questions THEN
      RAISE EXCEPTION 'Session consistency violation: session item count (%) does not match total_questions (%)',
        v_actual_item_count, NEW.total_questions;
    END IF;

    SELECT COUNT(*) INTO v_unanswered_count
    FROM public.interview_session_items
    WHERE session_id = NEW.id AND status NOT IN ('answered', 'skipped');

    IF v_unanswered_count > 0 THEN
      RAISE EXCEPTION 'Premature completion: cannot mark session completed while % of % questions remain unanswered',
        v_unanswered_count, NEW.total_questions;
    END IF;

    SELECT COUNT(*) INTO v_answered_item_count
    FROM public.interview_session_items
    WHERE session_id = NEW.id AND status = 'answered';

    NEW.completed_questions := v_actual_item_count;

    IF NEW.overall_score IS NULL OR NEW.overall_score < 0 OR NEW.overall_score > 100 THEN
      RAISE EXCEPTION 'Session consistency violation: overall_score must be between 0 and 100 on completion (got: %)',
        NEW.overall_score;
    END IF;

    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF NEW.status = 'in_progress' AND TG_OP = 'UPDATE' THEN
    SELECT COUNT(*) INTO v_answered_item_count
    FROM public.interview_session_items
    WHERE session_id = NEW.id AND status = 'answered';
    NEW.completed_questions := v_answered_item_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_interview_session_consistency
  BEFORE INSERT OR UPDATE ON public.interview_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_interview_session_consistency();

-- ----------------------------------------------------------------------------
-- 6. Candidate Answers & Deterministic Rubric Evaluations
-- Approved Weighting: Correctness 40%, Completeness 25%, Relevance 20%, Clarity 15%
-- ----------------------------------------------------------------------------
CREATE TABLE public.interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_item_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_answer_text TEXT NOT NULL,
    correctness_score NUMERIC(5, 2) NOT NULL,
    completeness_score NUMERIC(5, 2) NOT NULL,
    relevance_score NUMERIC(5, 2) NOT NULL,
    clarity_score NUMERIC(5, 2) NOT NULL,
    total_score NUMERIC(5, 2) NOT NULL,
    matched_points_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_points_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    feedback_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    rubric_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_item_answer UNIQUE (session_item_id),
    CONSTRAINT fk_answers_item FOREIGN KEY (session_item_id, user_id) 
        REFERENCES public.interview_session_items(id, user_id) ON DELETE CASCADE,
    CONSTRAINT chk_correctness_bounds CHECK (correctness_score >= 0 AND correctness_score <= 100),
    CONSTRAINT chk_completeness_bounds CHECK (completeness_score >= 0 AND completeness_score <= 100),
    CONSTRAINT chk_relevance_bounds CHECK (relevance_score >= 0 AND relevance_score <= 100),
    CONSTRAINT chk_clarity_bounds CHECK (clarity_score >= 0 AND clarity_score <= 100),
    CONSTRAINT chk_total_bounds CHECK (total_score >= 0 AND total_score <= 100),
    CONSTRAINT chk_total_score_weighting CHECK (
        ABS(total_score - (
            0.40 * correctness_score + 
            0.25 * completeness_score + 
            0.20 * relevance_score + 
            0.15 * clarity_score
        )) <= 0.05
    )
);

CREATE INDEX idx_interview_answers_item ON public.interview_answers(session_item_id);
CREATE INDEX idx_interview_answers_user ON public.interview_answers(user_id);

-- Protect answers from insertion, modification, or deletion once parent session is completed
CREATE OR REPLACE FUNCTION protect_completed_session_answers()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id UUID;
  v_session_status VARCHAR(20);
BEGIN
  v_item_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_item_id ELSE NEW.session_item_id END;

  SELECT s.status INTO v_session_status
  FROM public.interview_session_items i
  JOIN public.interview_sessions s ON s.id = i.session_id
  WHERE i.id = v_item_id
  FOR SHARE OF s;

  IF v_session_status = 'completed' THEN
    RAISE EXCEPTION 'Cannot % answers on completed interview session', TG_OP;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_completed_session_answers
  BEFORE INSERT OR UPDATE OR DELETE ON public.interview_answers
  FOR EACH ROW EXECUTE FUNCTION protect_completed_session_answers();

-- ----------------------------------------------------------------------------
-- 7. Adaptive 7-Day Study Plans with Target Role Lifecycle Uniqueness
-- ----------------------------------------------------------------------------
CREATE TABLE public.interview_study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_role VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    daily_schedule_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_study_plan_status CHECK (status IN ('active', 'completed', 'archived')),
    CONSTRAINT chk_study_plan_progress CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

-- At most one active study plan per candidate per target role
CREATE UNIQUE INDEX uq_study_plan_user_role_active 
  ON public.interview_study_plans(user_id, target_role) 
  WHERE (status = 'active');

CREATE INDEX idx_interview_study_plans_user ON public.interview_study_plans(user_id);

-- ----------------------------------------------------------------------------
-- 8. Row Level Security Policies
-- Candidate read-only access to active question bank; Administrative write access
-- ----------------------------------------------------------------------------
ALTER TABLE public.interview_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY qbank_candidate_read ON public.interview_question_bank
    FOR SELECT USING (is_active = true);

CREATE POLICY qbank_admin_write ON public.interview_question_bank
    FOR ALL USING (
        auth.jwt()->>'role' = 'service_role' OR 
        auth.jwt()->>'is_admin' = 'true'
    ) WITH CHECK (
        auth.jwt()->>'role' = 'service_role' OR 
        auth.jwt()->>'is_admin' = 'true'
    );

CREATE POLICY sessions_isolation ON public.interview_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY session_items_isolation ON public.interview_session_items
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY answers_isolation ON public.interview_answers
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY study_plans_isolation ON public.interview_study_plans
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
