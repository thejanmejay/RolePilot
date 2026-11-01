-- ============================================================================
-- Migration 010: Explicit Record Provenance, Resume Studio, and Active Resumes
-- Author: RolePilot Architecture Team
-- Status: PLANNING & ISOLATED POSTGRESQL TESTING ONLY
-- Dependencies: public.profiles, public.resumes, public.experiences, public.educations, public.skills
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Composite Unique Constraints & Validity Columns on Parent Tables
-- Enables composite foreign keys (id, user_id) and document usability validation
-- ----------------------------------------------------------------------------
ALTER TABLE public.resumes
  ADD CONSTRAINT uq_resumes_id_user UNIQUE (id, user_id);

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS is_valid_document BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_status VARCHAR(32) NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_resumes_document_status') THEN
    ALTER TABLE public.resumes
      ADD CONSTRAINT chk_resumes_document_status CHECK (
        document_status IN ('pending_verification', 'verified', 'corrupt', 'missing_storage', 'unsupported_format')
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Explicit Record Provenance Columns & Composite Ownership on Child Tables
-- Column-specific ON DELETE SET NULL (resume_id) guarantees user_id is never nulled
-- ----------------------------------------------------------------------------
-- Experiences Provenance
ALTER TABLE public.experiences 
  ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown' 
    CONSTRAINT chk_experiences_source CHECK (source IN ('resume', 'manual', 'legacy_unknown')),
  ADD COLUMN resume_id UUID;

ALTER TABLE public.experiences
  ADD CONSTRAINT fk_experiences_resume_user FOREIGN KEY (resume_id, user_id) 
    REFERENCES public.resumes(id, user_id) ON DELETE SET NULL (resume_id);

ALTER TABLE public.experiences
  ADD CONSTRAINT chk_experiences_provenance CHECK (
    (source = 'resume' AND resume_id IS NOT NULL) OR
    (source IN ('manual', 'legacy_unknown') AND resume_id IS NULL)
  );

ALTER TABLE public.experiences ALTER COLUMN source SET DEFAULT 'manual';

CREATE INDEX idx_experiences_user_source ON public.experiences(user_id, source);
CREATE INDEX idx_experiences_resume_id ON public.experiences(resume_id);

-- Educations Provenance
ALTER TABLE public.educations 
  ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown' 
    CONSTRAINT chk_educations_source CHECK (source IN ('resume', 'manual', 'legacy_unknown')),
  ADD COLUMN resume_id UUID;

ALTER TABLE public.educations
  ADD CONSTRAINT fk_educations_resume_user FOREIGN KEY (resume_id, user_id) 
    REFERENCES public.resumes(id, user_id) ON DELETE SET NULL (resume_id);

ALTER TABLE public.educations
  ADD CONSTRAINT chk_educations_provenance CHECK (
    (source = 'resume' AND resume_id IS NOT NULL) OR
    (source IN ('manual', 'legacy_unknown') AND resume_id IS NULL)
  );

ALTER TABLE public.educations ALTER COLUMN source SET DEFAULT 'manual';

CREATE INDEX idx_educations_user_source ON public.educations(user_id, source);
CREATE INDEX idx_educations_resume_id ON public.educations(resume_id);

-- Skills Provenance
ALTER TABLE public.skills 
  ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown' 
    CONSTRAINT chk_skills_source CHECK (source IN ('resume', 'manual', 'legacy_unknown')),
  ADD COLUMN resume_id UUID;

ALTER TABLE public.skills
  ADD CONSTRAINT fk_skills_resume_user FOREIGN KEY (resume_id, user_id) 
    REFERENCES public.resumes(id, user_id) ON DELETE SET NULL (resume_id);

ALTER TABLE public.skills
  ADD CONSTRAINT chk_skills_provenance CHECK (
    (source = 'resume' AND resume_id IS NOT NULL) OR
    (source IN ('manual', 'legacy_unknown') AND resume_id IS NULL)
  );

ALTER TABLE public.skills ALTER COLUMN source SET DEFAULT 'manual';

CREATE INDEX idx_skills_user_source ON public.skills(user_id, source);
CREATE INDEX idx_skills_resume_id ON public.skills(resume_id);

-- ----------------------------------------------------------------------------
-- 3. Profile Scalar Field Provenance Column and Validation Trigger
-- Enforces valid keys, property structure, UUID format, and cross-user ownership
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN field_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION validate_profile_field_provenance()
RETURNS TRIGGER AS $$
DECLARE
  v_key TEXT;
  v_val JSONB;
  v_prop TEXT;
  v_source TEXT;
  v_resume_id_text TEXT;
  v_resume_id UUID;
  v_resume_owner UUID;
  v_allowed_keys TEXT[] := ARRAY[
    'first_name', 'last_name', 'phone', 'city', 'state', 'country',
    'headline', 'target_role', 'about', 'linkedin_url', 'github_url',
    'website_url', 'experience_years', 'experience_months', 'notice_period_days',
    'current_ctc', 'expected_ctc'
  ];
  v_allowed_props TEXT[] := ARRAY['source', 'resume_id', 'updated_at'];
BEGIN
  IF NEW.field_provenance IS NULL OR jsonb_typeof(NEW.field_provenance) != 'object' THEN
    RAISE EXCEPTION 'field_provenance must be a valid JSON object';
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(NEW.field_provenance) LOOP
    IF NOT (v_key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'Invalid field_provenance key: %. Must be an approved profile scalar field.', v_key;
    END IF;

    IF v_val IS NULL OR jsonb_typeof(v_val) != 'object' THEN
      RAISE EXCEPTION 'field_provenance.% must be a JSON object', v_key;
    END IF;

    -- Reject unsupported object properties
    FOR v_prop IN SELECT jsonb_object_keys(v_val) LOOP
      IF NOT (v_prop = ANY(v_allowed_props)) THEN
        RAISE EXCEPTION 'Unsupported property "%" in field_provenance.%. Allowed properties: source, resume_id, updated_at.', v_prop, v_key;
      END IF;
    END LOOP;

    v_source := v_val->>'source';
    v_resume_id_text := v_val->>'resume_id';

    IF v_source IS NULL OR NOT (v_source IN ('resume', 'manual', 'legacy_unknown')) THEN
      RAISE EXCEPTION 'field_provenance.% must specify source as resume, manual, or legacy_unknown', v_key;
    END IF;

    IF v_source = 'resume' THEN
      IF v_resume_id_text IS NULL OR v_resume_id_text = '' THEN
        RAISE EXCEPTION 'field_provenance.% with source=resume requires a non-null resume_id', v_key;
      END IF;

      BEGIN
        v_resume_id := v_resume_id_text::UUID;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'field_provenance.% resume_id "%" is not a valid UUID', v_key, v_resume_id_text;
      END;

      SELECT user_id INTO v_resume_owner FROM public.resumes WHERE id = v_resume_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'field_provenance.% references non-existent resume_id %', v_key, v_resume_id;
      END IF;

      IF v_resume_owner != NEW.id THEN
        RAISE EXCEPTION 'Cross-user violation: field_provenance.% resume_id % belongs to user %, not candidate %', 
          v_key, v_resume_id, v_resume_owner, NEW.id;
      END IF;

    ELSIF v_source IN ('manual', 'legacy_unknown') THEN
      IF v_resume_id_text IS NOT NULL THEN
        RAISE EXCEPTION 'field_provenance.% with source=% must have null resume_id', v_key, v_source;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_profile_field_provenance
  BEFORE INSERT OR UPDATE OF field_provenance ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION validate_profile_field_provenance();

-- ----------------------------------------------------------------------------
-- 4. Resume Studio Documents (Working Drafts with Explicit PDF Validity State)
-- ----------------------------------------------------------------------------
CREATE TABLE public.resume_studio_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    target_role VARCHAR(100) NOT NULL,
    template_id VARCHAR(50) NOT NULL DEFAULT 'professional',
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_version_number INTEGER NOT NULL DEFAULT 1,
    content_hash VARCHAR(64),
    storage_path TEXT,
    pdf_compilation_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    is_pdf_valid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_template_id CHECK (template_id IN ('professional', 'modern', 'minimal', 'technical')),
    CONSTRAINT chk_pdf_compilation_status CHECK (pdf_compilation_status IN ('draft', 'compiling', 'compiled_valid', 'compilation_failed')),
    CONSTRAINT uq_resume_studio_docs_id_user UNIQUE (id, user_id)
);

CREATE INDEX idx_resume_studio_docs_user ON public.resume_studio_documents(user_id);
CREATE INDEX idx_resume_studio_docs_updated ON public.resume_studio_documents(user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Resume Studio Versions (Strictly Immutable Historical Snapshots)
-- ----------------------------------------------------------------------------
CREATE TABLE public.resume_studio_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    user_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    change_summary VARCHAR(255),
    template_id VARCHAR(50) NOT NULL,
    target_role VARCHAR(100) NOT NULL,
    snapshot_content_json JSONB NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_versions_document_user FOREIGN KEY (document_id, user_id) 
        REFERENCES public.resume_studio_documents(id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_resume_studio_versions_doc_ver UNIQUE (document_id, version_number)
);

CREATE INDEX idx_resume_studio_versions_doc ON public.resume_studio_versions(document_id, version_number DESC);
CREATE INDEX idx_resume_studio_versions_user ON public.resume_studio_versions(user_id);

CREATE OR REPLACE FUNCTION enforce_resume_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'resume_studio_versions rows are immutable and cannot be modified (version_id: %)', OLD.id;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.resume_studio_documents WHERE id = OLD.document_id) THEN
      RAISE EXCEPTION 'resume_studio_versions rows are immutable and cannot be deleted while document exists (version_id: %)', OLD.id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_resume_version_immutability
  BEFORE UPDATE OR DELETE ON public.resume_studio_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_resume_version_immutability();

-- ----------------------------------------------------------------------------
-- 6. Resume Studio Improvements
-- ----------------------------------------------------------------------------
CREATE TABLE public.resume_studio_improvements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rule_id VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'suggestion',
    current_snippet TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT fk_improvements_document_user FOREIGN KEY (document_id, user_id) 
        REFERENCES public.resume_studio_documents(id, user_id) ON DELETE CASCADE,
    CONSTRAINT chk_improvement_status CHECK (status IN ('pending', 'applied', 'dismissed')),
    CONSTRAINT chk_improvement_severity CHECK (severity IN ('suggestion', 'warning', 'critical')),
    CONSTRAINT chk_improvement_category CHECK (category IN (
        'action_verbs', 'metrics', 'skills', 'dates', 'contact', 'summary', 'formatting', 'readability'
    ))
);

CREATE INDEX idx_resume_studio_improvements_doc ON public.resume_studio_improvements(document_id, status);

-- ----------------------------------------------------------------------------
-- 7. Dedicated Active Application Resumes Pointer with Composite Ownership
-- ----------------------------------------------------------------------------
CREATE TABLE public.active_application_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    uploaded_resume_id UUID,
    studio_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_active_application_resumes_user UNIQUE (user_id),
    CONSTRAINT fk_active_resumes_uploaded FOREIGN KEY (uploaded_resume_id, user_id) 
        REFERENCES public.resumes(id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_active_resumes_studio FOREIGN KEY (studio_document_id, user_id) 
        REFERENCES public.resume_studio_documents(id, user_id) ON DELETE CASCADE,
    CONSTRAINT chk_exactly_one_resume_source CHECK (
        (uploaded_resume_id IS NOT NULL AND studio_document_id IS NULL) OR
        (uploaded_resume_id IS NULL AND studio_document_id IS NOT NULL)
    )
);

CREATE INDEX idx_active_resumes_uploaded ON public.active_application_resumes(uploaded_resume_id);
CREATE INDEX idx_active_resumes_studio ON public.active_application_resumes(studio_document_id);

-- ----------------------------------------------------------------------------
-- 8. Fallback Triggers for Safe Active Resume Deletion
-- Evaluates usable storage_path and explicit is_pdf_valid and pdf_compilation_status='compiled_valid'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_uploaded_resume_deletion_fallback()
RETURNS TRIGGER AS $$
DECLARE
  v_fallback_resume_id UUID;
  v_fallback_studio_id UUID;
BEGIN
  -- Convert child provenance records of deleted resume to legacy_unknown before deletion
  UPDATE public.experiences 
  SET source = 'legacy_unknown', resume_id = NULL 
  WHERE resume_id = OLD.id AND user_id = OLD.user_id;

  UPDATE public.educations 
  SET source = 'legacy_unknown', resume_id = NULL 
  WHERE resume_id = OLD.id AND user_id = OLD.user_id;

  UPDATE public.skills 
  SET source = 'legacy_unknown', resume_id = NULL 
  WHERE resume_id = OLD.id AND user_id = OLD.user_id;

  -- If this was the active uploaded resume
  IF EXISTS (SELECT 1 FROM public.active_application_resumes WHERE user_id = OLD.user_id AND uploaded_resume_id = OLD.id) THEN
    -- Check for remaining uploaded resumes that have a usable, non-empty storage_path
    -- Fall back to latest older uploaded resume with verified usable PDF document
    SELECT id INTO v_fallback_resume_id
    FROM public.resumes
    WHERE user_id = OLD.user_id 
      AND id != OLD.id
      AND is_active = true
      AND storage_path IS NOT NULL 
      AND length(trim(storage_path)) > 0
      AND is_valid_document = true
      AND document_status = 'verified'
      AND file_mime_type = 'application/pdf'
    ORDER BY version DESC, created_at DESC
    LIMIT 1;

    IF v_fallback_resume_id IS NOT NULL THEN
      UPDATE public.active_application_resumes
      SET uploaded_resume_id = v_fallback_resume_id, updated_at = now()
      WHERE user_id = OLD.user_id;

      UPDATE public.resumes
      SET is_active = (id = v_fallback_resume_id)
      WHERE user_id = OLD.user_id AND id != OLD.id;
    ELSE
      -- Check for fallback studio document with confirmed valid compiled PDF
      SELECT id INTO v_fallback_studio_id
      FROM public.resume_studio_documents
      WHERE user_id = OLD.user_id 
        AND is_pdf_valid = true 
        AND pdf_compilation_status = 'compiled_valid'
        AND storage_path IS NOT NULL
        AND length(trim(storage_path)) > 0
      ORDER BY updated_at DESC
      LIMIT 1;

      IF v_fallback_studio_id IS NOT NULL THEN
        UPDATE public.active_application_resumes
        SET uploaded_resume_id = NULL, studio_document_id = v_fallback_studio_id, updated_at = now()
        WHERE user_id = OLD.user_id;
      ELSE
        -- If no valid uploaded or compiled studio resume exists, remove active pointer
        DELETE FROM public.active_application_resumes WHERE user_id = OLD.user_id;
      END IF;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_uploaded_resume_deletion_fallback
  BEFORE DELETE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION handle_uploaded_resume_deletion_fallback();

CREATE OR REPLACE FUNCTION handle_studio_document_deletion_fallback()
RETURNS TRIGGER AS $$
DECLARE
  v_fallback_resume_id UUID;
  v_fallback_studio_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.active_application_resumes WHERE user_id = OLD.user_id AND studio_document_id = OLD.id) THEN
    -- Fall back to latest uploaded resume with verified usable PDF document if available
    SELECT id INTO v_fallback_resume_id
    FROM public.resumes
    WHERE user_id = OLD.user_id
      AND is_active = true
      AND storage_path IS NOT NULL 
      AND length(trim(storage_path)) > 0
      AND is_valid_document = true
      AND document_status = 'verified'
      AND file_mime_type = 'application/pdf'
    ORDER BY version DESC, created_at DESC
    LIMIT 1;

    IF v_fallback_resume_id IS NOT NULL THEN
      UPDATE public.active_application_resumes
      SET studio_document_id = NULL, uploaded_resume_id = v_fallback_resume_id, updated_at = now()
      WHERE user_id = OLD.user_id;

      UPDATE public.resumes
      SET is_active = (id = v_fallback_resume_id)
      WHERE user_id = OLD.user_id;
    ELSE
      -- Fall back to another eligible studio document with valid compiled PDF
      SELECT id INTO v_fallback_studio_id
      FROM public.resume_studio_documents
      WHERE user_id = OLD.user_id 
        AND id != OLD.id 
        AND is_pdf_valid = true 
        AND pdf_compilation_status = 'compiled_valid'
        AND storage_path IS NOT NULL
        AND length(trim(storage_path)) > 0
      ORDER BY updated_at DESC
      LIMIT 1;

      IF v_fallback_studio_id IS NOT NULL THEN
        UPDATE public.active_application_resumes
        SET studio_document_id = v_fallback_studio_id, updated_at = now()
        WHERE user_id = OLD.user_id;
      ELSE
        DELETE FROM public.active_application_resumes WHERE user_id = OLD.user_id;
      END IF;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_studio_document_deletion_fallback
  BEFORE DELETE ON public.resume_studio_documents
  FOR EACH ROW EXECUTE FUNCTION handle_studio_document_deletion_fallback();

-- Enforce that active_application_resumes can only point to a usable, verified uploaded resume or compiled studio doc
CREATE OR REPLACE FUNCTION validate_active_application_resume_validity()
RETURNS TRIGGER AS $$
DECLARE
  v_storage_path TEXT;
  v_is_valid_document BOOLEAN;
  v_document_status VARCHAR(32);
  v_file_mime_type VARCHAR(100);
  v_pdf_valid BOOLEAN;
  v_comp_status VARCHAR(30);
BEGIN
  IF NEW.uploaded_resume_id IS NOT NULL THEN
    SELECT storage_path, is_valid_document, document_status, file_mime_type
    INTO v_storage_path, v_is_valid_document, v_document_status, v_file_mime_type
    FROM public.resumes
    WHERE id = NEW.uploaded_resume_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    IF v_storage_path IS NULL OR length(trim(v_storage_path)) = 0 
       OR v_is_valid_document IS NOT TRUE 
       OR v_document_status != 'verified' 
       OR v_file_mime_type != 'application/pdf' THEN
      RAISE EXCEPTION 'Cannot set active resume: referenced uploaded resume % is not a verified, usable PDF document (status: %, valid: %, mime: %)', 
        NEW.uploaded_resume_id, v_document_status, v_is_valid_document, v_file_mime_type;
    END IF;
  ELSIF NEW.studio_document_id IS NOT NULL THEN
    SELECT is_pdf_valid, pdf_compilation_status, storage_path 
    INTO v_pdf_valid, v_comp_status, v_storage_path
    FROM public.resume_studio_documents
    WHERE id = NEW.studio_document_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    IF v_pdf_valid IS NOT TRUE OR v_comp_status != 'compiled_valid' OR v_storage_path IS NULL OR length(trim(v_storage_path)) = 0 THEN
      RAISE EXCEPTION 'Cannot set active resume: referenced studio document % does not have a compiled valid PDF', NEW.studio_document_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_active_application_resume_validity
  BEFORE INSERT OR UPDATE ON public.active_application_resumes
  FOR EACH ROW EXECUTE FUNCTION validate_active_application_resume_validity();

-- Prevent invalidating document status, format, or storage_path of an active uploaded resume
CREATE OR REPLACE FUNCTION check_active_uploaded_resume_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.storage_path IS NULL OR length(trim(NEW.storage_path)) = 0 
      OR NEW.is_valid_document IS NOT TRUE 
      OR NEW.document_status != 'verified' 
      OR NEW.file_mime_type != 'application/pdf') THEN
    IF EXISTS (SELECT 1 FROM public.active_application_resumes WHERE uploaded_resume_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot invalidate status, format, or storage_path of currently active uploaded resume %', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_active_uploaded_resume_integrity
  BEFORE UPDATE OF storage_path, is_valid_document, document_status, file_mime_type ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION check_active_uploaded_resume_integrity();

-- Prevent invalidating compiled PDF status of an active studio document
CREATE OR REPLACE FUNCTION check_active_studio_document_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.is_pdf_valid IS NOT TRUE OR NEW.pdf_compilation_status != 'compiled_valid' OR NEW.storage_path IS NULL OR length(trim(NEW.storage_path)) = 0) THEN
    IF EXISTS (SELECT 1 FROM public.active_application_resumes WHERE studio_document_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot invalidate compiled PDF status of currently active studio document %', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_active_studio_document_integrity
  BEFORE UPDATE OF is_pdf_valid, pdf_compilation_status, storage_path ON public.resume_studio_documents
  FOR EACH ROW EXECUTE FUNCTION check_active_studio_document_integrity();

-- ----------------------------------------------------------------------------
-- 9. Row Level Security Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.resume_studio_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_studio_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_studio_improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_application_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY resume_studio_docs_isolation ON public.resume_studio_documents
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY resume_studio_versions_isolation ON public.resume_studio_versions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY resume_studio_improvements_isolation ON public.resume_studio_improvements
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY active_resumes_isolation ON public.active_application_resumes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 10. Existing-Data Seeding: Populate Pointer Table from Active Uploaded Resumes
-- Only verified, usable PDF documents are eligible for initial active pointer
-- ----------------------------------------------------------------------------
INSERT INTO public.active_application_resumes (user_id, uploaded_resume_id)
SELECT DISTINCT ON (user_id) user_id, id
FROM public.resumes
WHERE is_active = true
  AND storage_path IS NOT NULL 
  AND length(trim(storage_path)) > 0
  AND is_valid_document = true
  AND document_status = 'verified'
  AND file_mime_type = 'application/pdf'
ORDER BY user_id, version DESC
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
