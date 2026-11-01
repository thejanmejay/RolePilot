-- ============================================================================
-- Rollback for Migration 010: Resume Studio Documents, Versions, and Active Resumes
-- Author: RolePilot Architecture Team
-- Dependencies strictly removed in topological order without unnecessary CASCADE
-- ============================================================================

BEGIN;

-- 1. Drop active resume integrity, validity, and fallback triggers & functions
DROP TRIGGER IF EXISTS trg_validate_active_application_resume_validity ON public.active_application_resumes;
DROP FUNCTION IF EXISTS validate_active_application_resume_validity();

DROP TRIGGER IF EXISTS trg_check_active_uploaded_resume_integrity ON public.resumes;
DROP FUNCTION IF EXISTS check_active_uploaded_resume_integrity();

DROP TRIGGER IF EXISTS trg_handle_uploaded_resume_deletion_fallback ON public.resumes;
DROP TRIGGER IF EXISTS trg_uploaded_resume_deletion_fallback ON public.resumes;
DROP FUNCTION IF EXISTS handle_uploaded_resume_deletion_fallback();

-- 2. Drop studio document fallback and integrity triggers & functions
DROP TRIGGER IF EXISTS trg_check_active_studio_document_integrity ON public.resume_studio_documents;
DROP FUNCTION IF EXISTS check_active_studio_document_integrity();

DROP TRIGGER IF EXISTS trg_handle_studio_document_deletion_fallback ON public.resume_studio_documents;
DROP TRIGGER IF EXISTS trg_studio_document_deletion_fallback ON public.resume_studio_documents;
DROP FUNCTION IF EXISTS handle_studio_document_deletion_fallback();

-- 3. Drop active pointer table (explicit RESTRICT)
DROP TABLE IF EXISTS public.active_application_resumes RESTRICT;

-- 4. Drop triggers on resume_studio_versions before dropping tables
DROP TRIGGER IF EXISTS trg_enforce_resume_version_immutability ON public.resume_studio_versions;
DROP FUNCTION IF EXISTS enforce_resume_version_immutability();

-- 5. Drop Studio child tables before parent table (explicit RESTRICT)
DROP TABLE IF EXISTS public.resume_studio_improvements RESTRICT;
DROP TABLE IF EXISTS public.resume_studio_versions RESTRICT;
DROP TABLE IF EXISTS public.resume_studio_documents RESTRICT;

-- 6. Drop profile scalar provenance validation trigger, function, and column
DROP TRIGGER IF EXISTS trg_validate_profile_field_provenance ON public.profiles;
DROP FUNCTION IF EXISTS validate_profile_field_provenance();
ALTER TABLE public.profiles DROP COLUMN IF EXISTS field_provenance;

-- 7. Drop child provenance constraints, foreign keys, indexes, and columns
ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS chk_skills_provenance;
ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS fk_skills_resume_user;
DROP INDEX IF EXISTS public.idx_skills_resume_id;
DROP INDEX IF EXISTS public.idx_skills_user_source;
ALTER TABLE public.skills DROP COLUMN IF EXISTS resume_id, DROP COLUMN IF EXISTS source;

ALTER TABLE public.educations DROP CONSTRAINT IF EXISTS chk_educations_provenance;
ALTER TABLE public.educations DROP CONSTRAINT IF EXISTS fk_educations_resume_user;
DROP INDEX IF EXISTS public.idx_educations_resume_id;
DROP INDEX IF EXISTS public.idx_educations_user_source;
ALTER TABLE public.educations DROP COLUMN IF EXISTS resume_id, DROP COLUMN IF EXISTS source;

ALTER TABLE public.experiences DROP CONSTRAINT IF EXISTS chk_experiences_provenance;
ALTER TABLE public.experiences DROP CONSTRAINT IF EXISTS fk_experiences_resume_user;
DROP INDEX IF EXISTS public.idx_experiences_resume_id;
DROP INDEX IF EXISTS public.idx_experiences_user_source;
ALTER TABLE public.experiences DROP COLUMN IF EXISTS resume_id, DROP COLUMN IF EXISTS source;

-- 8. Drop resume document validity columns and constraints added to parent resumes table
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS chk_resumes_document_status;
ALTER TABLE public.resumes 
  DROP COLUMN IF EXISTS file_mime_type, 
  DROP COLUMN IF EXISTS document_status, 
  DROP COLUMN IF EXISTS is_valid_document;

-- 9. Drop composite unique constraint on resumes
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS uq_resumes_id_user;

COMMIT;
