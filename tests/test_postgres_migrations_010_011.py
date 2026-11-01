"""Comprehensive PostgreSQL 16 Integration Test Suite for Migration 010 and 011.

Validates all Gate 1 database architecture criteria:
1. Legacy resume records default to pending_verification and cannot become active until verified.
2. Cross-user composite foreign keys reject unauthorized access across all entities.
3. Concurrent answer mutations (INSERT, UPDATE, DELETE) are deterministically blocked and rejected during completion.
4. Concurrency rollback behavior allows unblocked transactions to proceed if completion aborts.
5. Scoring boundary values (0, 100), negative bounds, precision delta tolerance (0.05 vs 0.06) strictly enforced.
6. Physical question-bank deletion sets question_bank_id to NULL while fully preserving snapshots and sessions.
7. Rollbacks strictly preserve unrelated schema objects and enforce safe topological ordering via RESTRICT.
8. Backend resume verification service validates physical storage, PDF magic bytes, and parseability.
"""

import multiprocessing
import os
import threading
import time
import uuid
import pytest
import psycopg

PG_URL = os.getenv("TEST_POSTGRES_URL", "postgresql://localhost:55432/rolepilot_test")


def _worker_activate_resume_proc(pg_url: str, user_id: uuid.UUID, resume_id: uuid.UUID, out_queue):
    """Independent OS process worker invoking ResumeService.activate_resume_and_sync_profile."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from backend.app.services.resume_service import ResumeService
    from backend.app.schemas.resume import ResumeActivationRequest

    engine = create_engine(pg_url, pool_pre_ping=True)
    payload = ResumeActivationRequest(
        accepted_fields={},
        add_skills=True,
        add_experiences=True,
        add_educations=True,
        clear_stale_fields=True,
    )
    try:
        with Session(engine) as db:
            resp = ResumeService.activate_resume_and_sync_profile(
                db=db,
                user_id=user_id,
                resume_id=resume_id,
                payload=payload,
            )
            out_queue.put({"success": True, "active_id": str(resp.resume.id), "error": None})
    except Exception as exc:
        out_queue.put({"success": False, "active_id": None, "error": str(exc)})
    finally:
        engine.dispose()


def is_postgres_available() -> bool:
    try:
        with psycopg.connect(PG_URL, connect_timeout=1) as conn:
            return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not is_postgres_available(),
    reason="Isolated PostgreSQL 16 test server on port 55432 is not running",
)


def read_sql_file(relative_path: str) -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    full_path = os.path.join(base_dir, relative_path)
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def wait_for_lock_wait(conn: psycopg.Connection, target_pid: int, timeout: float = 3.0) -> bool:
    """Deterministic barrier polling PostgreSQL lock manager to confirm target PID is waiting for a lock."""
    start = time.time()
    while time.time() - start < timeout:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM pg_locks WHERE pid = %s AND NOT granted;", (target_pid,))
            if cur.fetchone()[0] > 0:
                return True
        time.sleep(0.02)
    return False


@pytest.fixture(scope="module")
def pg_conn():
    conn = psycopg.connect(PG_URL, autocommit=True)
    yield conn
    conn.close()


def setup_base_schema(conn: psycopg.Connection):
    """Setup clean schema simulating database state up through Migration 008/009."""
    with conn.cursor() as cur:
        cur.execute("RESET ROLE;")
        cur.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        cur.execute("CREATE SCHEMA IF NOT EXISTS auth;")
        cur.execute("""
            CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ 
                SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID; 
            $$ LANGUAGE sql;
        """)
        cur.execute("""
            CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB AS $$
                SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::jsonb);
            $$ LANGUAGE sql;
        """)
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

        cur.execute("""
            CREATE TABLE public.profiles (
                id UUID PRIMARY KEY,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100) DEFAULT 'India',
                linkedin_url TEXT,
                github_url TEXT,
                website_url TEXT,
                headline TEXT,
                target_role TEXT,
                experience_years INTEGER NOT NULL DEFAULT 0,
                experience_months INTEGER NOT NULL DEFAULT 0,
                notice_period_days INTEGER NOT NULL DEFAULT 30,
                current_ctc NUMERIC,
                expected_ctc NUMERIC,
                authorized_to_work BOOLEAN NOT NULL DEFAULT true,
                willing_to_relocate BOOLEAN NOT NULL DEFAULT true,
                onboarding_completed BOOLEAN NOT NULL DEFAULT false,
                onboarding_completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE public.resumes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                storage_path TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                is_active BOOLEAN NOT NULL DEFAULT true,
                parsed_text TEXT,
                parsed_data JSONB,
                created_at TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE public.experiences (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                company_name VARCHAR(255) NOT NULL,
                job_title VARCHAR(255) NOT NULL,
                start_date DATE,
                end_date DATE,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE public.educations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                institution VARCHAR(255) NOT NULL,
                degree VARCHAR(100),
                field_of_study VARCHAR(100),
                start_year VARCHAR(10),
                end_year VARCHAR(10),
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE public.skills (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                years INTEGER NOT NULL DEFAULT 0,
                months INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now(),
                CONSTRAINT uq_skills_user_id_name UNIQUE (user_id, name)
            );

            CREATE TABLE public.job_descriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE public.job_match_analyses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                job_description_id UUID NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
                match_score NUMERIC(5, 2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)


def test_01_legacy_resume_validation_and_active_pointer(pg_conn):
    """Test Requirement 1: Legacy resumes default to pending_verification and cannot become active until verified."""
    setup_base_schema(pg_conn)

    user_legacy = uuid.uuid4()
    resume_legacy_active = uuid.uuid4()
    resume_legacy_old = uuid.uuid4()

    # Insert legacy resumes BEFORE Migration 010 is applied
    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, 'legacy@test.com')", (user_legacy,))
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active)
            VALUES (%s, %s, 'legacy_active.pdf', 'path_legacy_active.pdf', 2, true)
        """, (resume_legacy_active, user_legacy))
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active)
            VALUES (%s, %s, 'legacy_old.pdf', 'path_legacy_old.pdf', 1, false)
        """, (resume_legacy_old, user_legacy))

    # Apply Migration 010
    with pg_conn.cursor() as cur:
        cur.execute(read_sql_file("migrations/010_create_resume_studio_and_active_resumes.sql"))

    with pg_conn.cursor() as cur:
        # 1. Existing legacy records receive safe defaults: is_valid_document = false, document_status = 'pending_verification'
        cur.execute("SELECT is_valid_document, document_status, file_mime_type FROM public.resumes WHERE id = %s", (resume_legacy_active,))
        row = cur.fetchone()
        assert row[0] is False, "Legacy resume must default to is_valid_document = false"
        assert row[1] == "pending_verification", "Legacy resume must default to pending_verification"
        assert row[2] == "application/pdf"

        # 2. Existing legacy unverified records are NOT seeded into active_application_resumes
        cur.execute("SELECT count(*) FROM public.active_application_resumes WHERE user_id = %s", (user_legacy,))
        assert cur.fetchone()[0] == 0, "Unverified legacy resume must not be seeded into active pointer table"

        # 3. Attempting to assign unverified legacy resume to active pointer is strictly rejected
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.active_application_resumes (user_id, uploaded_resume_id)
                VALUES (%s, %s)
            """, (user_legacy, resume_legacy_active))
        err_msg = str(exc_info.value)
        assert "is not a verified, usable PDF document" in err_msg
        assert "status: pending_verification" in err_msg

        # 4. Check constraint rejects unapproved document_status strings
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("UPDATE public.resumes SET document_status = 'trusted_admin' WHERE id = %s", (resume_legacy_active,))
        assert "chk_resumes_document_status" in str(exc_info.value)

        # 5. Missing storage object rejection
        res_missing = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active, is_valid_document, document_status)
            VALUES (%s, %s, 'missing.pdf', 'path_missing.pdf', 3, false, false, 'missing_storage')
        """, (res_missing, user_legacy))
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("INSERT INTO public.active_application_resumes (user_id, uploaded_resume_id) VALUES (%s, %s)", (user_legacy, res_missing))
        assert "is not a verified, usable PDF document" in str(exc_info.value)

        # 6. Corrupted PDF rejection
        res_corrupt = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active, is_valid_document, document_status)
            VALUES (%s, %s, 'corrupt.pdf', 'path_corrupt.pdf', 4, false, false, 'corrupt')
        """, (res_corrupt, user_legacy))
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("INSERT INTO public.active_application_resumes (user_id, uploaded_resume_id) VALUES (%s, %s)", (user_legacy, res_corrupt))
        assert "is not a verified, usable PDF document" in str(exc_info.value)

        # 7. Non-PDF format rejection (e.g. image/png)
        res_png = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active, is_valid_document, document_status, file_mime_type)
            VALUES (%s, %s, 'photo.png', 'path_photo.png', 5, false, false, 'unsupported_format', 'image/png')
        """, (res_png, user_legacy))
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("INSERT INTO public.active_application_resumes (user_id, uploaded_resume_id) VALUES (%s, %s)", (user_legacy, res_png))
        assert "is not a verified, usable PDF document" in str(exc_info.value)

        # 8. Trusted promotion: Only when verified can a document be set as active
        cur.execute("""
            UPDATE public.resumes 
            SET is_valid_document = true, document_status = 'verified' 
            WHERE id = %s
        """, (resume_legacy_active,))
        cur.execute("""
            INSERT INTO public.active_application_resumes (user_id, uploaded_resume_id)
            VALUES (%s, %s)
        """, (user_legacy, resume_legacy_active))
        cur.execute("SELECT uploaded_resume_id FROM public.active_application_resumes WHERE user_id = %s", (user_legacy,))
        assert cur.fetchone()[0] == resume_legacy_active

        # 9. Active resume integrity guard: Cannot mutate verified active resume to corrupt or missing storage
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("UPDATE public.resumes SET document_status = 'corrupt' WHERE id = %s", (resume_legacy_active,))
        assert "Cannot invalidate status, format, or storage_path of currently active uploaded resume" in str(exc_info.value)


def test_02_comprehensive_cross_user_isolation(pg_conn):
    """Test Requirement 2: Strict cross-user composite foreign key enforcement across all relationships."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()

    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, %s), (%s, %s)", 
                    (user_a, f"cand_a_{uuid.uuid4().hex[:6]}@test.com", user_b, f"cand_b_{uuid.uuid4().hex[:6]}@test.com"))

        # A's resources
        res_a = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, is_valid_document, document_status)
            VALUES (%s, %s, 'a.pdf', 'p_a.pdf', true, 'verified')
        """, (res_a, user_a))

        doc_a = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.resume_studio_documents (id, user_id, title, target_role, is_pdf_valid, pdf_compilation_status, storage_path)
            VALUES (%s, %s, 'Doc A', 'Dev', true, 'compiled_valid', 'p_doc_a.pdf')
        """, (doc_a, user_a))

        jd_a = uuid.uuid4()
        cur.execute("INSERT INTO public.job_descriptions (id, user_id, title, company) VALUES (%s, %s, 'JD', 'Co')", (jd_a, user_a))

        match_a = uuid.uuid4()
        cur.execute("INSERT INTO public.job_match_analyses (id, user_id, job_description_id, match_score) VALUES (%s, %s, %s, 85.0)", (match_a, user_a, jd_a))

    # Apply Migration 011
    with pg_conn.cursor() as cur:
        cur.execute(read_sql_file("migrations/011_create_interview_preparation_tables.sql"))

    with pg_conn.cursor() as cur:
        # A's interview session & item
        sess_a = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.interview_sessions (id, user_id, resume_document_id, job_match_analysis_id, session_type, target_role, difficulty, total_questions)
            VALUES (%s, %s, %s, %s, 'practice', 'Dev', 'intermediate', 1)
        """, (sess_a, user_a, doc_a, match_a))

        item_a = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.interview_session_items (id, session_id, user_id, question_snapshot_json, sequence_order)
            VALUES (%s, %s, %s, '{"text": "Q1"}', 1)
        """, (item_a, sess_a, user_a))

        # 1. Candidate B referencing Candidate A's interview resume document (studio doc)
        sess_b_invalid = uuid.uuid4()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_sessions (id, user_id, resume_document_id, session_type, target_role, difficulty, total_questions)
                VALUES (%s, %s, %s, 'practice', 'Dev', 'intermediate', 1)
            """, (sess_b_invalid, user_b, doc_a))
        assert "fk_sessions_studio_doc" in str(exc_info.value)

        # 2. Candidate B referencing Candidate A's job-match analysis
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_sessions (id, user_id, job_match_analysis_id, session_type, target_role, difficulty, total_questions)
                VALUES (%s, %s, %s, 'practice', 'Dev', 'intermediate', 1)
            """, (sess_b_invalid, user_b, match_a))
        assert "fk_sessions_job_match" in str(exc_info.value)

        # 3. Candidate B inserting interview session item referencing Candidate A's session
        item_b_invalid = uuid.uuid4()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_session_items (id, session_id, user_id, question_snapshot_json, sequence_order)
                VALUES (%s, %s, %s, '{"text": "Hijack"}', 2)
            """, (item_b_invalid, sess_a, user_b))
        assert "fk_session_items_session" in str(exc_info.value)

        # 4. Candidate B inserting answer referencing Candidate A's session item
        ans_b_invalid = uuid.uuid4()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_answers 
                (id, session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                VALUES (%s, %s, %s, 'Evil Ans', 80.0, 80.0, 80.0, 80.0, 80.0)
            """, (ans_b_invalid, item_a, user_b))
        assert "fk_answers_item" in str(exc_info.value)

        # 5. Candidate B referencing Candidate A's Studio document through active resume assignment
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.active_application_resumes (user_id, studio_document_id)
                VALUES (%s, %s)
            """, (user_b, doc_a))
        assert "fk_active_resumes_studio" in str(exc_info.value)

        # 6. Candidate B referencing Candidate A's Studio document through Studio versions
        ver_b_invalid = uuid.uuid4()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.resume_studio_versions
                (id, document_id, user_id, version_number, template_id, target_role, snapshot_content_json, content_hash)
                VALUES (%s, %s, %s, 1, 'professional', 'Dev', '{}'::jsonb, 'hash_abc')
            """, (ver_b_invalid, doc_a, user_b))
        assert "fk_versions_document_user" in str(exc_info.value)

        # 7. Candidate B referencing Candidate A's Studio document through Studio improvements
        imp_b_invalid = uuid.uuid4()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.resume_studio_improvements
                (id, document_id, user_id, rule_id, category, current_snippet, suggestion, reason)
                VALUES (%s, %s, %s, 'r1', 'skills', 'old', 'new', 'reason')
            """, (imp_b_invalid, doc_a, user_b))
        assert "fk_improvements_document_user" in str(exc_info.value)

        # Same-user operations succeed
        ans_a_valid = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (id, session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, %s, 'Valid A Ans', 80.0, 80.0, 80.0, 80.0, 80.0)
        """, (ans_a_valid, item_a, user_a))
        cur.execute("SELECT id FROM public.interview_answers WHERE id = %s", (ans_a_valid,))
        assert cur.fetchone()[0] == ans_a_valid


def test_03_concurrent_answer_mutation_during_completion(pg_conn):
    """Test Requirement 3: Deterministic barrier verification for concurrent answer INSERT, UPDATE, DELETE during completion."""
    user = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, %s)", (user, f"concur_ans_{uuid.uuid4().hex[:6]}@test.com"))

    # Setup 3 sessions with items for testing INSERT, UPDATE, DELETE
    def create_session_with_item():
        sess_id = uuid.uuid4()
        it_id = uuid.uuid4()
        with pg_conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.interview_sessions (id, user_id, session_type, target_role, difficulty, total_questions, status)
                VALUES (%s, %s, 'practice', 'QA', 'intermediate', 1, 'in_progress')
            """, (sess_id, user))
            cur.execute("""
                INSERT INTO public.interview_session_items (id, session_id, user_id, question_snapshot_json, sequence_order, status)
                VALUES (%s, %s, %s, '{"text": "Concur"}', 1, 'unanswered')
            """, (it_id, sess_id, user))
        return sess_id, it_id

    # -------------------------------------------------------------------------
    # Subtest 3A: Concurrent INSERT answer during completion
    # -------------------------------------------------------------------------
    sess_a, item_a = create_session_with_item()
    conn_comp_a = psycopg.connect(PG_URL, autocommit=False)
    conn_cand_a = psycopg.connect(PG_URL, autocommit=False)
    try:
        cur_comp = conn_comp_a.cursor()
        cur_cand = conn_cand_a.cursor()

        # Conn 1 begins completion transaction and acquires row lock on session
        cur_comp.execute("SELECT id FROM public.interview_sessions WHERE id = %s FOR UPDATE;", (sess_a,))

        cand_status_a = []

        def attempt_insert():
            try:
                cur_cand.execute("""
                    INSERT INTO public.interview_answers 
                    (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                    VALUES (%s, %s, 'Ans', 80.0, 80.0, 80.0, 80.0, 80.0)
                """, (item_a, user))
                conn_cand_a.commit()
                cand_status_a.append("inserted")
            except Exception as e:
                conn_cand_a.rollback()
                cand_status_a.append(f"blocked_rejected: {e}")

        t_a = threading.Thread(target=attempt_insert)
        t_a.start()

        # Deterministic barrier: poll PostgreSQL lock manager until candidate PID is waiting on lock
        is_blocked = wait_for_lock_wait(pg_conn, conn_cand_a.info.backend_pid, timeout=3.0)
        assert is_blocked is True, "Candidate INSERT must be blocked by row lock on parent session"
        assert len(cand_status_a) == 0

        # Conn 1 updates item to answered and completes session
        cur_comp.execute("UPDATE public.interview_session_items SET status = 'answered' WHERE id = %s", (item_a,))
        cur_comp.execute("UPDATE public.interview_sessions SET status = 'completed', overall_score = 80.0 WHERE id = %s", (sess_a,))
        conn_comp_a.commit()

        t_a.join(timeout=2.0)
        assert len(cand_status_a) == 1
        assert "Cannot INSERT answers on completed interview session" in cand_status_a[0]
    finally:
        conn_comp_a.close()
        conn_cand_a.close()

    # -------------------------------------------------------------------------
    # Subtest 3B: Concurrent UPDATE answer during completion
    # -------------------------------------------------------------------------
    sess_b, item_b = create_session_with_item()
    ans_b = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.interview_answers 
            (id, session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, %s, 'Original Ans', 80.0, 80.0, 80.0, 80.0, 80.0)
        """, (ans_b, item_b, user))
        cur.execute("UPDATE public.interview_session_items SET status = 'answered' WHERE id = %s", (item_b,))

    conn_comp_b = psycopg.connect(PG_URL, autocommit=False)
    conn_cand_b = psycopg.connect(PG_URL, autocommit=False)
    try:
        cur_comp = conn_comp_b.cursor()
        cur_cand = conn_cand_b.cursor()

        cur_comp.execute("SELECT id FROM public.interview_sessions WHERE id = %s FOR UPDATE;", (sess_b,))

        cand_status_b = []

        def attempt_update():
            try:
                cur_cand.execute("UPDATE public.interview_answers SET user_answer_text = 'Hacked' WHERE id = %s", (ans_b,))
                conn_cand_b.commit()
                cand_status_b.append("updated")
            except Exception as e:
                conn_cand_b.rollback()
                cand_status_b.append(f"blocked_rejected: {e}")

        t_b = threading.Thread(target=attempt_update)
        t_b.start()

        is_blocked = wait_for_lock_wait(pg_conn, conn_cand_b.info.backend_pid, timeout=3.0)
        assert is_blocked is True, "Candidate UPDATE must be blocked by row lock on parent session"
        assert len(cand_status_b) == 0

        cur_comp.execute("UPDATE public.interview_sessions SET status = 'completed', overall_score = 80.0 WHERE id = %s", (sess_b,))
        conn_comp_b.commit()

        t_b.join(timeout=2.0)
        assert len(cand_status_b) == 1
        assert "Cannot UPDATE answers on completed interview session" in cand_status_b[0]
    finally:
        conn_comp_b.close()
        conn_cand_b.close()

    # -------------------------------------------------------------------------
    # Subtest 3C: Concurrent DELETE answer during completion
    # -------------------------------------------------------------------------
    sess_c, item_c = create_session_with_item()
    ans_c = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.interview_answers 
            (id, session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, %s, 'To Delete', 80.0, 80.0, 80.0, 80.0, 80.0)
        """, (ans_c, item_c, user))
        cur.execute("UPDATE public.interview_session_items SET status = 'answered' WHERE id = %s", (item_c,))

    conn_comp_c = psycopg.connect(PG_URL, autocommit=False)
    conn_cand_c = psycopg.connect(PG_URL, autocommit=False)
    try:
        cur_comp = conn_comp_c.cursor()
        cur_cand = conn_cand_c.cursor()

        cur_comp.execute("SELECT id FROM public.interview_sessions WHERE id = %s FOR UPDATE;", (sess_c,))

        cand_status_c = []

        def attempt_delete():
            try:
                cur_cand.execute("DELETE FROM public.interview_answers WHERE id = %s", (ans_c,))
                conn_cand_c.commit()
                cand_status_c.append("deleted")
            except Exception as e:
                conn_cand_c.rollback()
                cand_status_c.append(f"blocked_rejected: {e}")

        t_c = threading.Thread(target=attempt_delete)
        t_c.start()

        is_blocked = wait_for_lock_wait(pg_conn, conn_cand_c.info.backend_pid, timeout=3.0)
        assert is_blocked is True, "Candidate DELETE must be blocked by row lock on parent session"
        assert len(cand_status_c) == 0

        cur_comp.execute("UPDATE public.interview_sessions SET status = 'completed', overall_score = 80.0 WHERE id = %s", (sess_c,))
        conn_comp_c.commit()

        t_c.join(timeout=2.0)
        assert len(cand_status_c) == 1
        assert "Cannot DELETE answers on completed interview session" in cand_status_c[0]
    finally:
        conn_comp_c.close()
        conn_cand_c.close()

    # -------------------------------------------------------------------------
    # Subtest 3D: Transaction Rollback Behavior (if completion fails/aborts)
    # -------------------------------------------------------------------------
    sess_d, item_d = create_session_with_item()
    ans_d = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.interview_answers 
            (id, session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, %s, 'Pre-rollback Ans', 80.0, 80.0, 80.0, 80.0, 80.0)
        """, (ans_d, item_d, user))

    conn_comp_d = psycopg.connect(PG_URL, autocommit=False)
    conn_cand_d = psycopg.connect(PG_URL, autocommit=False)
    try:
        cur_comp = conn_comp_d.cursor()
        cur_cand = conn_cand_d.cursor()

        # Conn 1 acquires lock
        cur_comp.execute("SELECT id FROM public.interview_sessions WHERE id = %s FOR UPDATE;", (sess_d,))

        cand_status_d = []

        def attempt_rollback_case_update():
            try:
                cur_cand.execute("UPDATE public.interview_answers SET user_answer_text = 'UpdatedAfterRollback' WHERE id = %s", (ans_d,))
                conn_cand_d.commit()
                cand_status_d.append("success")
            except Exception as e:
                conn_cand_d.rollback()
                cand_status_d.append(f"failed: {e}")

        t_d = threading.Thread(target=attempt_rollback_case_update)
        t_d.start()

        is_blocked = wait_for_lock_wait(pg_conn, conn_cand_d.info.backend_pid, timeout=3.0)
        assert is_blocked is True, "Candidate operation must wait while lock is held"

        # Conn 1 encounters an error or rolls back completion
        conn_comp_d.rollback()

        t_d.join(timeout=2.0)
        assert len(cand_status_d) == 1
        assert cand_status_d[0] == "success", "Candidate operation must succeed after completion rolls back"

        with pg_conn.cursor() as cur:
            cur.execute("SELECT user_answer_text FROM public.interview_answers WHERE id = %s", (ans_d,))
            assert cur.fetchone()[0] == "UpdatedAfterRollback"
    finally:
        conn_comp_d.close()
        conn_cand_d.close()

    # -------------------------------------------------------------------------
    # Subtest 3E: Concurrent session-item UPDATE during completion
    # -------------------------------------------------------------------------
    sess_e, item_e = create_session_with_item()
    # Mark item as answered so session can be completed
    with pg_conn.cursor() as cur:
        cur.execute("UPDATE public.interview_session_items SET status = 'answered' WHERE id = %s", (item_e,))

    conn_comp_e = psycopg.connect(PG_URL, autocommit=False)
    conn_cand_e = psycopg.connect(PG_URL, autocommit=False)
    try:
        cur_comp = conn_comp_e.cursor()
        cur_cand = conn_cand_e.cursor()

        # Conn 1 begins completion transaction and acquires row lock on session
        cur_comp.execute("SELECT id FROM public.interview_sessions WHERE id = %s FOR UPDATE;", (sess_e,))

        cand_status_e = []

        def attempt_item_update():
            try:
                cur_cand.execute("UPDATE public.interview_session_items SET status = 'skipped' WHERE id = %s", (item_e,))
                conn_cand_e.commit()
                cand_status_e.append("success")
            except Exception as e:
                conn_cand_e.rollback()
                cand_status_e.append(f"blocked_rejected: {e}")

        t_e = threading.Thread(target=attempt_item_update)
        t_e.start()

        is_blocked = wait_for_lock_wait(pg_conn, conn_cand_e.info.backend_pid, timeout=3.0)
        assert is_blocked is True, "Candidate item UPDATE must be blocked by row lock on parent session"
        assert len(cand_status_e) == 0

        # Conn 1 completes session
        cur_comp.execute("UPDATE public.interview_sessions SET status = 'completed', overall_score = 80.0 WHERE id = %s", (sess_e,))
        conn_comp_e.commit()

        t_e.join(timeout=2.0)
        assert len(cand_status_e) == 1
        assert "Cannot UPDATE session items on completed interview session" in cand_status_e[0]
    finally:
        conn_comp_e.close()
        conn_cand_e.close()

    # -------------------------------------------------------------------------
    # Subtest 3F: Concurrent question deactivation during session-item INSERT
    # -------------------------------------------------------------------------
    sess_f = uuid.uuid4()
    item_f = uuid.uuid4()
    q_id_f = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.interview_question_bank (id, question_key, question_text, category, difficulty, target_role, skill_tag, is_active)
            VALUES (%s, %s, 'Concurrency Question 3F', 'technical', 'intermediate', 'QA', 'testing', true)
        """, (q_id_f, f"key_{uuid.uuid4().hex[:8]}"))
        cur.execute("""
            INSERT INTO public.interview_sessions (id, user_id, session_type, target_role, difficulty, total_questions, status)
            VALUES (%s, %s, 'practice', 'QA', 'intermediate', 1, 'in_progress')
        """, (sess_f, user))

    conn_admin_f = psycopg.connect(PG_URL, autocommit=False)
    conn_cand_f = psycopg.connect(PG_URL, autocommit=False)
    try:
        cur_admin = conn_admin_f.cursor()
        cur_cand = conn_cand_f.cursor()

        # Admin starts transaction and deactivates question (holds exclusive row lock)
        cur_admin.execute("UPDATE public.interview_question_bank SET is_active = false WHERE id = %s;", (q_id_f,))

        cand_status_f = []

        def attempt_item_insert_concur():
            try:
                cur_cand.execute("""
                    INSERT INTO public.interview_session_items 
                    (id, session_id, user_id, question_bank_id, question_snapshot_json, sequence_order, status)
                    VALUES (%s, %s, %s, %s, '{"text": "Snap"}', 1, 'unanswered')
                """, (item_f, sess_f, user, q_id_f))
                conn_cand_f.commit()
                cand_status_f.append("inserted")
            except Exception as e:
                conn_cand_f.rollback()
                cand_status_f.append(f"blocked_rejected: {e}")

        t_f = threading.Thread(target=attempt_item_insert_concur)
        t_f.start()

        is_blocked = wait_for_lock_wait(pg_conn, conn_cand_f.info.backend_pid, timeout=3.0)
        assert is_blocked is True, "Candidate item INSERT must be blocked by row lock on question_bank"
        assert len(cand_status_f) == 0

        # Admin commits deactivation
        conn_admin_f.commit()

        t_f.join(timeout=2.0)
        assert len(cand_status_f) == 1
        assert "Cannot add inactive question" in cand_status_f[0]
    finally:
        conn_admin_f.close()
        conn_cand_f.close()


def test_04_scoring_boundaries_and_rubric_weights(pg_conn):
    """Test Requirement 4: Scoring boundary values (0, 100), precision delta tolerance (0.05 vs 0.06), and NOT NULL constraints."""
    user = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, %s)", (user, f"scoring_bounds_{uuid.uuid4().hex[:6]}@test.com"))
        sess_id = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.interview_sessions (id, user_id, session_type, target_role, difficulty, total_questions)
            VALUES (%s, %s, 'practice', 'QA', 'intermediate', 10)
        """, (sess_id, user))

    def make_item():
        it_id = uuid.uuid4()
        with pg_conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.interview_session_items (id, session_id, user_id, question_snapshot_json, sequence_order)
                VALUES (%s, %s, %s, '{"q": 1}', (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM public.interview_session_items WHERE session_id = %s))
            """, (it_id, sess_id, user, sess_id))
        return it_id

    with pg_conn.cursor() as cur:
        # 1. All component scores = 0 -> total 0 accepted
        it1 = make_item()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, 'Zero Ans', 0.0, 0.0, 0.0, 0.0, 0.0)
        """, (it1, user))
        cur.execute("SELECT total_score FROM public.interview_answers WHERE session_item_id = %s", (it1,))
        assert float(cur.fetchone()[0]) == 0.0

        # 2. All component scores = 100 -> total 100 accepted
        it2 = make_item()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, 'Full Ans', 100.0, 100.0, 100.0, 100.0, 100.0)
        """, (it2, user))
        cur.execute("SELECT total_score FROM public.interview_answers WHERE session_item_id = %s", (it2,))
        assert float(cur.fetchone()[0]) == 100.0

        # 3. Negative component score rejected
        it3 = make_item()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_answers 
                (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                VALUES (%s, %s, 'Negative', -1.0, 50.0, 50.0, 50.0, 30.0)
            """, (it3, user))
        assert "chk_correctness_bounds" in str(exc_info.value)

        # 4. Component score above 100 rejected
        it4 = make_item()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_answers 
                (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                VALUES (%s, %s, 'Above 100', 105.0, 50.0, 50.0, 50.0, 72.0)
            """, (it4, user))
        assert "chk_correctness_bounds" in str(exc_info.value)

        # 5. NULL component score rejected by NOT NULL constraint (cannot be bypassed by NULL semantics)
        it5 = make_item()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_answers 
                (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                VALUES (%s, %s, 'Null score', NULL, 50.0, 50.0, 50.0, 50.0)
            """, (it5, user))
        assert "null value in column \"correctness_score\"" in str(exc_info.value)

        # 6. Correct weighted score: C=90(36.0), Comp=80(20.0), R=85(17.0), Cl=70(10.5) -> sum = 83.50 accepted
        it6 = make_item()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, 'Standard Ans', 90.0, 80.0, 85.0, 70.0, 83.50)
        """, (it6, user))
        cur.execute("SELECT total_score FROM public.interview_answers WHERE session_item_id = %s", (it6,))
        assert float(cur.fetchone()[0]) == 83.50

        # 7. Incorrect weighted score rejected
        it7 = make_item()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_answers 
                (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                VALUES (%s, %s, 'Wrong total', 90.0, 80.0, 85.0, 70.0, 95.0)
            """, (it7, user))
        assert "chk_total_score_weighting" in str(exc_info.value)

        # 8. Tolerance Delta Testing: base score 80.00 (all components 80.0)
        # Delta = +0.05 accepted
        it8 = make_item()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, 'Tolerance +0.05', 80.0, 80.0, 80.0, 80.0, 80.05)
        """, (it8, user))
        cur.execute("SELECT total_score FROM public.interview_answers WHERE session_item_id = %s", (it8,))
        assert float(cur.fetchone()[0]) == 80.05

        # Delta = +0.06 REJECTED
        it9 = make_item()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_answers 
                (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                VALUES (%s, %s, 'Tolerance +0.06', 80.0, 80.0, 80.0, 80.0, 80.06)
            """, (it9, user))
        assert "chk_total_score_weighting" in str(exc_info.value)

        # Delta = -0.05 accepted
        it10 = make_item()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, 'Tolerance -0.05', 80.0, 80.0, 80.0, 80.0, 79.95)
        """, (it10, user))
        cur.execute("SELECT total_score FROM public.interview_answers WHERE session_item_id = %s", (it10,))
        assert float(cur.fetchone()[0]) == 79.95

        # Delta = -0.06 REJECTED
        it11 = make_item()
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute("""
                INSERT INTO public.interview_answers 
                (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
                VALUES (%s, %s, 'Tolerance -0.06', 80.0, 80.0, 80.0, 80.0, 79.94)
            """, (it11, user))
        assert "chk_total_score_weighting" in str(exc_info.value)

        # 9. Historical rubric version preservation: custom rubric versions (e.g. 'v0.9-legacy' or 'v1.1') are accepted and preserved
        it12 = make_item()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score, rubric_version)
            VALUES (%s, %s, 'Legacy Rubric Answer', 80.0, 80.0, 80.0, 80.0, 80.0, 'v0.9-legacy')
        """, (it12, user))
        cur.execute("SELECT rubric_version FROM public.interview_answers WHERE session_item_id = %s", (it12,))
        assert cur.fetchone()[0] == 'v0.9-legacy'


def test_05_question_deletion_and_snapshot_preservation(pg_conn):
    """Test Requirement 5: Physical question-bank deletion sets question_bank_id to NULL while fully preserving snapshots and sessions."""
    user = uuid.uuid4()
    q_to_delete = uuid.uuid4()
    q_unrelated = uuid.uuid4()

    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, %s)", (user, f"q_del_{uuid.uuid4().hex[:6]}@test.com"))

        cur.execute("""
            INSERT INTO public.interview_question_bank 
            (id, question_key, version, is_active, category, difficulty, target_role, skill_tag, question_text)
            VALUES (%s, 'q_del_test', 1, true, 'programming', 'intermediate', 'Backend', 'Python', 'Explain Python GIL')
        """, (q_to_delete,))

        cur.execute("""
            INSERT INTO public.interview_question_bank 
            (id, question_key, version, is_active, category, difficulty, target_role, skill_tag, question_text)
            VALUES (%s, 'q_survive_test', 1, true, 'programming', 'intermediate', 'Backend', 'Python', 'Explain generators')
        """, (q_unrelated,))

        sess_id = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.interview_sessions (id, user_id, session_type, target_role, difficulty, total_questions)
            VALUES (%s, %s, 'practice', 'Backend', 'intermediate', 1)
        """, (sess_id, user))

        item_id = uuid.uuid4()
        snapshot_payload = {"question": "Explain Python GIL", "skill": "Python", "rubric_hints": ["thread lock", "concurrency"]}
        cur.execute("""
            INSERT INTO public.interview_session_items 
            (id, session_id, user_id, question_bank_id, question_snapshot_json, sequence_order, status)
            VALUES (%s, %s, %s, %s, %s::jsonb, 1, 'answered')
        """, (item_id, sess_id, user, q_to_delete, psycopg.types.json.Jsonb(snapshot_payload)))

        ans_id = uuid.uuid4()
        cur.execute("""
            INSERT INTO public.interview_answers 
            (id, session_item_id, user_id, user_answer_text, correctness_score, completeness_score, relevance_score, clarity_score, total_score)
            VALUES (%s, %s, %s, 'GIL ensures one thread executes bytecode at a time', 85.0, 80.0, 85.0, 75.0, 82.25)
        """, (ans_id, item_id, user))

    # Perform physical DELETE of the question-bank row
    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM public.interview_question_bank WHERE id = %s", (q_to_delete,))

        # 1. Row in question_bank is deleted
        cur.execute("SELECT count(*) FROM public.interview_question_bank WHERE id = %s", (q_to_delete,))
        assert cur.fetchone()[0] == 0

        # 2. In session items, question_bank_id becomes NULL through ON DELETE SET NULL
        cur.execute("SELECT question_bank_id, question_snapshot_json, status FROM public.interview_session_items WHERE id = %s", (item_id,))
        row = cur.fetchone()
        assert row[0] is None, "question_bank_id must be set to NULL via ON DELETE SET NULL"

        # 3. question_snapshot_json remains intact and identical
        assert row[1] == snapshot_payload, "question_snapshot_json must remain completely unchanged after question deletion"
        assert row[2] == "answered"

        # 4. Historical interview session data remains readable
        cur.execute("SELECT status, total_questions FROM public.interview_sessions WHERE id = %s", (sess_id,))
        sess_row = cur.fetchone()
        assert sess_row[0] == "in_progress"
        assert sess_row[1] == 1

        # 5. Candidate answer remains readable and intact
        cur.execute("SELECT total_score, user_answer_text FROM public.interview_answers WHERE id = %s", (ans_id,))
        ans_row = cur.fetchone()
        assert ans_row[0] == 82.25

        # 6. Unrelated questions survive intact
        cur.execute("SELECT count(*) FROM public.interview_question_bank WHERE id = %s", (q_unrelated,))
        assert cur.fetchone()[0] == 1


def test_06_comprehensive_rollback_and_schema_preservation(pg_conn):
    """Test Requirement 6: Rollback preserves unrelated objects, proves ownership of uq_job_match_analyses_id_user, and validates RESTRICT."""
    with pg_conn.cursor() as cur:
        # 1. Verify uq_job_match_analyses_id_user exists under Migration 011
        cur.execute("""
            SELECT conname FROM pg_constraint 
            WHERE conname = 'uq_job_match_analyses_id_user';
        """)
        assert cur.fetchone() is not None, "uq_job_match_analyses_id_user must exist while Migration 011 is active"

        # 2. Test incorrect rollback order: Attempting to rollback 010 first while 011 exists MUST fail safely with RESTRICT error
        with pytest.raises(psycopg.Error) as exc_info:
            cur.execute(read_sql_file("migrations/rollback/010_rollback_resume_studio.sql"))
        assert "cannot drop table resume_studio_documents because other objects depend on it" in str(exc_info.value).lower()
        pg_conn.rollback()

        # 3. Correct rollback order: Run Migration 011 rollback first
        cur.execute(read_sql_file("migrations/rollback/011_rollback_interview_prep.sql"))

        # Prove: uq_job_match_analyses_id_user was introduced by Migration 011 and is dropped by 011 rollback
        cur.execute("SELECT conname FROM pg_constraint WHERE conname = 'uq_job_match_analyses_id_user';")
        assert cur.fetchone() is None, "uq_job_match_analyses_id_user must be dropped by 011 rollback"

        # Prove: The underlying Migration 008 table (job_match_analyses) survives completely!
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_match_analyses';")
        assert cur.fetchone()[0] == 1, "job_match_analyses from Migration 008 must survive 011 rollback"

        # 4. Now run Migration 010 rollback
        cur.execute(read_sql_file("migrations/rollback/010_rollback_resume_studio.sql"))

        # 5. Verify all Migration 010 and 011 tables are removed
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'active_application_resumes', 'resume_studio_documents', 'resume_studio_versions',
                'resume_studio_improvements', 'interview_sessions', 'interview_session_items',
                'interview_answers', 'interview_study_plans', 'interview_question_bank'
            )
        """)
        residual_tables = cur.fetchall()
        assert len(residual_tables) == 0, f"Expected 0 tables after rollback, found: {residual_tables}"

        # 6. Verify all Migration 010 and 011 triggers and functions are removed
        cur.execute("""
            SELECT routine_name FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name IN (
                'validate_interview_session_consistency', 'protect_completed_session_items',
                'protect_completed_session_answers', 'validate_session_item_question_active',
                'handle_studio_document_deletion_fallback', 'handle_uploaded_resume_deletion_fallback',
                'validate_profile_field_provenance', 'enforce_resume_version_immutability',
                'check_active_uploaded_resume_integrity', 'check_active_studio_document_integrity',
                'validate_active_application_resume_validity'
            )
        """)
        residual_functions = cur.fetchall()
        assert len(residual_functions) == 0, f"Expected 0 functions after rollback, found: {residual_functions}"

        # 7. Verify unrelated baseline tables and columns completely survived rollback
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('profiles', 'resumes', 'experiences', 'educations', 'skills', 'job_descriptions', 'job_match_analyses')
        """)
        assert len(cur.fetchall()) == 7, "All 7 pre-existing baseline tables must survive rollback intact"

        # 8. Re-apply both migrations cleanly after rollback
        cur.execute(read_sql_file("migrations/010_create_resume_studio_and_active_resumes.sql"))
        cur.execute(read_sql_file("migrations/011_create_interview_preparation_tables.sql"))

        # Verify all 9 tables exist after clean re-application
        cur.execute("""
            SELECT count(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'active_application_resumes', 'resume_studio_documents', 'resume_studio_versions',
                'resume_studio_improvements', 'interview_sessions', 'interview_session_items',
                'interview_answers', 'interview_study_plans', 'interview_question_bank'
            )
        """)
        assert cur.fetchone()[0] == 9, "All 9 tables must be recreated after re-application"


def test_07_backend_resume_verification_service(pg_conn):
    """Test Requirement 8: Backend ResumeVerificationService validates physical storage, PDF magic bytes, and parseability."""
    from backend.app.services.resume_verification_service import ResumeVerificationService
    from backend.app.services.resume_service import save_local_resume_bytes
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    pg_conn.rollback()
    test_engine = create_engine(PG_URL)

    user = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, %s)", (user, f"verif_svc_{uuid.uuid4().hex[:6]}@test.com"))

    with Session(test_engine) as db:
        # A. Missing physical storage
        res_missing = uuid.uuid4()
        with pg_conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.resumes (id, user_id, file_name, storage_path, is_valid_document, document_status)
                VALUES (%s, %s, 'missing.pdf', 'resumes/missing.pdf', false, 'pending_verification')
            """, (res_missing, user))

        valid, status_str = ResumeVerificationService.verify_resume_document(db, user, res_missing)
        assert valid is False
        assert status_str == "missing_storage"

        # B. Non-PDF file (PNG header)
        res_png = uuid.uuid4()
        png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRFakePngBytes"
        save_local_resume_bytes(user, res_png, png_bytes)
        with pg_conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.resumes (id, user_id, file_name, storage_path, is_valid_document, document_status)
                VALUES (%s, %s, 'photo.png', 'resumes/photo.png', false, 'pending_verification')
            """, (res_png, user))

        valid, status_str = ResumeVerificationService.verify_resume_document(db, user, res_png)
        assert valid is False
        assert status_str == "unsupported_format"

        # C. Corrupted PDF (Starts with %PDF- but corrupt/unparseable body)
        res_corrupt = uuid.uuid4()
        corrupt_bytes = b"%PDF-1.4\ncorrupted_body_without_xref_or_pages\n%%EOF"
        save_local_resume_bytes(user, res_corrupt, corrupt_bytes)
        with pg_conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.resumes (id, user_id, file_name, storage_path, is_valid_document, document_status)
                VALUES (%s, %s, 'corrupt.pdf', 'resumes/corrupt.pdf', false, 'pending_verification')
            """, (res_corrupt, user))

        valid, status_str = ResumeVerificationService.verify_resume_document(db, user, res_corrupt)
        assert valid is False
        assert status_str == "corrupt"

        # D. Valid PDF document (Standard %PDF- with valid xref and page tree)
        res_valid = uuid.uuid4()
        valid_pdf_bytes = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
            b"4 0 obj\n<< /Length 50 >>\nstream\nBT /F1 12 Tf 72 712 Td (Verified Candidate Resume) Tj ET\nendstream\nendobj\n"
            b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000345 00000 n \n"
            b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n426\n%%EOF"
        )
        save_local_resume_bytes(user, res_valid, valid_pdf_bytes)
        with pg_conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.resumes (id, user_id, file_name, storage_path, is_valid_document, document_status)
                VALUES (%s, %s, 'valid.pdf', 'resumes/valid.pdf', false, 'pending_verification')
            """, (res_valid, user))

        valid, status_str = ResumeVerificationService.verify_resume_document(db, user, res_valid)
        assert valid is True
        assert status_str == "verified"

        # Verify DB row was promoted by the service
        with pg_conn.cursor() as cur:
            cur.execute("SELECT is_valid_document, document_status, file_mime_type FROM public.resumes WHERE id = %s", (res_valid,))
            db_row = cur.fetchone()
            assert db_row[0] is True
            assert db_row[1] == "verified"
            assert db_row[2] == "application/pdf"

        # E. Batch verification summary
        summary = ResumeVerificationService.verify_all_pending_resumes(db, user_id=user)
        # All were processed individually above, so pending count is 0
        assert sum(summary.values()) == 0


def test_08_postgres_resume_service_pointer_sync_and_cross_process_concurrency(pg_conn):
    """Test Requirement 9: ResumeService pointer synchronization on PostgreSQL without source_type,

    dual-pointer synchronization with Resume.is_active, cross-process concurrency serialization,
    and rollback behavior on failed activation.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from fastapi import HTTPException
    from backend.app.services.resume_service import ResumeService, save_local_resume_bytes
    from backend.app.schemas.resume import ResumeActivationRequest

    pg_conn.rollback()
    test_engine = create_engine(PG_URL, pool_pre_ping=True)

    valid_pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length 50 >>\nstream\nBT /F1 12 Tf 72 712 Td (Verified Candidate Resume) Tj ET\nendstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000345 00000 n \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n426\n%%EOF"
    )

    user = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, %s)", (user, f"sync_svc_{uuid.uuid4().hex[:6]}@test.com"))

    res1 = uuid.uuid4()
    res2 = uuid.uuid4()
    save_local_resume_bytes(user, res1, valid_pdf_bytes)
    save_local_resume_bytes(user, res2, valid_pdf_bytes)

    with pg_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active, is_valid_document, document_status, file_mime_type)
            VALUES (%s, %s, 'r1.pdf', 'resumes/r1.pdf', 1, false, true, 'verified', 'application/pdf'),
                   (%s, %s, 'r2.pdf', 'resumes/r2.pdf', 2, false, true, 'verified', 'application/pdf');
        """, (res1, user, res2, user))

    payload = ResumeActivationRequest(
        accepted_fields={},
        add_skills=True,
        add_experiences=True,
        add_educations=True,
        clear_stale_fields=True,
    )

    # 1. Activate res1 using ResumeService directly against real PostgreSQL
    with Session(test_engine) as db:
        resp1 = ResumeService.activate_resume_and_sync_profile(db, user, res1, payload)
        assert resp1.resume.id == res1
        assert resp1.resume.is_active is True

    # Verify both System A (Resume.is_active) and System B (active_application_resumes) in PostgreSQL
    with pg_conn.cursor() as cur:
        cur.execute("SELECT id, is_active FROM public.resumes WHERE user_id = %s ORDER BY version ASC", (user,))
        rows = cur.fetchall()
        assert rows[0][1] is True  # res1 is active
        assert rows[1][1] is False  # res2 is inactive

        cur.execute("SELECT uploaded_resume_id, studio_document_id FROM public.active_application_resumes WHERE user_id = %s", (user,))
        act_row = cur.fetchone()
        assert act_row is not None
        assert act_row[0] == res1
        assert act_row[1] is None  # studio_document_id is NULL

    # 2. Activate res2 (replacement) and verify atomic pointer transition
    with Session(test_engine) as db:
        resp2 = ResumeService.activate_resume_and_sync_profile(db, user, res2, payload)
        assert resp2.resume.id == res2
        assert resp2.resume.is_active is True

    with pg_conn.cursor() as cur:
        cur.execute("SELECT id, is_active FROM public.resumes WHERE user_id = %s ORDER BY version ASC", (user,))
        rows = cur.fetchall()
        assert rows[0][1] is False  # res1 deactivated
        assert rows[1][1] is True  # res2 activated

        cur.execute("SELECT uploaded_resume_id, studio_document_id FROM public.active_application_resumes WHERE user_id = %s", (user,))
        act_row = cur.fetchone()
        assert act_row[0] == res2
        assert act_row[1] is None

    # 3. Concurrency test: Two independent OS processes attempting concurrent activation
    c_user = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("INSERT INTO public.profiles (id, email) VALUES (%s, %s)", (c_user, f"concurrent_{uuid.uuid4().hex[:6]}@test.com"))

    c_res1 = uuid.uuid4()
    c_res2 = uuid.uuid4()
    save_local_resume_bytes(c_user, c_res1, valid_pdf_bytes)
    save_local_resume_bytes(c_user, c_res2, valid_pdf_bytes)

    with pg_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active, is_valid_document, document_status, file_mime_type)
            VALUES (%s, %s, 'c1.pdf', 'resumes/c1.pdf', 1, false, true, 'verified', 'application/pdf'),
                   (%s, %s, 'c2.pdf', 'resumes/c2.pdf', 2, false, true, 'verified', 'application/pdf');
        """, (c_res1, c_user, c_res2, c_user))

    ctx = multiprocessing.get_context("spawn")
    q1 = ctx.Queue()
    q2 = ctx.Queue()

    p1 = ctx.Process(target=_worker_activate_resume_proc, args=(PG_URL, c_user, c_res1, q1))
    p2 = ctx.Process(target=_worker_activate_resume_proc, args=(PG_URL, c_user, c_res2, q2))

    p1.start()
    p2.start()
    p1.join(timeout=10)
    p2.join(timeout=10)

    res1_out = q1.get(timeout=2)
    res2_out = q2.get(timeout=2)

    assert res1_out["success"] is True, f"Worker 1 failed: {res1_out['error']}"
    assert res2_out["success"] is True, f"Worker 2 failed: {res2_out['error']}"

    # Verify exactly ONE resume is active in public.resumes
    with pg_conn.cursor() as cur:
        cur.execute("SELECT id FROM public.resumes WHERE user_id = %s AND is_active = true", (c_user,))
        active_resumes = cur.fetchall()
        assert len(active_resumes) == 1, f"Expected exactly 1 active resume, found: {active_resumes}"
        final_active_id = active_resumes[0][0]

        # Verify active_application_resumes points to that exact same resume
        cur.execute("SELECT uploaded_resume_id, studio_document_id FROM public.active_application_resumes WHERE user_id = %s", (c_user,))
        act_row = cur.fetchone()
        assert act_row is not None
        assert act_row[0] == final_active_id
        assert act_row[1] is None

    # 4. Rollback and retry behavior: Attempting to activate an unverified resume
    unverified_res = uuid.uuid4()
    with pg_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO public.resumes (id, user_id, file_name, storage_path, version, is_active, is_valid_document, document_status, file_mime_type)
            VALUES (%s, %s, 'unverif.pdf', 'resumes/unverif.pdf', 3, false, false, 'pending_verification', 'application/pdf');
        """, (unverified_res, c_user))

    with Session(test_engine) as db:
        with pytest.raises(HTTPException) as exc_info:
            ResumeService.activate_resume_and_sync_profile(db, c_user, unverified_res, payload)
        assert exc_info.value.status_code == 400

    # Ensure previous active state is completely unchanged
    with pg_conn.cursor() as cur:
        cur.execute("SELECT id FROM public.resumes WHERE user_id = %s AND is_active = true", (c_user,))
        active_after_abort = cur.fetchall()
        assert len(active_after_abort) == 1
        assert active_after_abort[0][0] == final_active_id

        cur.execute("SELECT uploaded_resume_id, studio_document_id FROM public.active_application_resumes WHERE user_id = %s", (c_user,))
        act_after = cur.fetchone()
        assert act_after[0] == final_active_id
        assert act_after[1] is None

