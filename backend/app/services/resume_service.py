"""Resume service for uploading, parsing, versioning, verifying, and managing user resumes."""

from __future__ import annotations

import io
import logging
import os
from pathlib import Path
import re
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, UploadFile, status
import pdfplumber
from sqlalchemy import func, select, update, text
from sqlalchemy.orm import Session
from supabase import Client, create_client

from backend.app.core.config import settings
from backend.app.db.models.education import Education
from backend.app.db.models.experience import Experience
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.skill import Skill
from backend.app.schemas.resume import (
    ConflictField,
    ProfileSyncDiff,
    ResumeActivationRequest,
    ResumeActivationResponse,
    ResumeReplacementResponse,
    ResumeResponse,
)
from backend.app.services.resume_parser import ResumeParser
from backend.app.services.resume_verification_service import ResumeVerificationService

logger = logging.getLogger("rolepilot.resume_service")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def get_supabase_client() -> Optional[Client]:
    """Get Supabase client with service role key for storage operations if configured."""
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    elif settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return None


def get_local_resume_path(user_id: uuid.UUID, resume_id: uuid.UUID) -> Path:
    """Return local disk storage path for user resume PDF binary."""
    base_dir = Path("data") / "resumes" / str(user_id)
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / f"{resume_id}.pdf"


_user_activation_locks: Dict[uuid.UUID, threading.Lock] = {}
_activation_mutex = threading.Lock()


def _get_user_activation_lock(user_id: uuid.UUID) -> threading.Lock:
    """Thread-safe user-scoped activation lock to prevent concurrent activation race conditions."""
    with _activation_mutex:
        if user_id not in _user_activation_locks:
            _user_activation_locks[user_id] = threading.Lock()
        return _user_activation_locks[user_id]


def save_local_resume_bytes(user_id: uuid.UUID, resume_id: uuid.UUID, content: bytes) -> bool:
    """Save resume PDF bytes to disk for offline and development preview."""
    try:
        path = get_local_resume_path(user_id, resume_id)
        path.write_bytes(content)
        return True
    except Exception as e:
        logger.error(f"Failed to save local resume bytes for user {user_id}, resume {resume_id}: {e}")
        return False


def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using pdfplumber."""
    extracted_text = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                extracted_text.append(text)
    return "\n\n".join(extracted_text)


def parse_resume_structure(text_content: str) -> Dict[str, Any]:
    """Extract structured data hints from resume text."""
    parsed: Dict[str, Any] = {
        "emails": [],
        "phones": [],
        "skills_detected": [],
        "word_count": len(text_content.split()),
    }
    emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text_content)
    parsed["emails"] = list(set(emails))

    phones = re.findall(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text_content)
    parsed["phones"] = list(set(phones))

    common_skills = [
        "python", "javascript", "typescript", "react", "fastapi", "django",
        "sql", "postgresql", "docker", "kubernetes", "aws", "playwright",
        "selenium", "selenium webdriver", "postman", "git", "ci/cd", "linux"
    ]
    text_lower = text_content.lower()
    for skill in common_skills:
        if re.search(r"\b" + re.escape(skill) + r"\b", text_lower):
            parsed["skills_detected"].append(skill)

    return parsed


class ResumeService:
    @staticmethod
    def _sync_active_application_resume_pointer(
        db: Session, user_id: uuid.UUID, resume_id: uuid.UUID
    ) -> None:
        """Synchronize the active_application_resumes table so both System A and System B are identical."""
        try:
            bind = db.get_bind()
            if bind and bind.dialect.name == "postgresql":
                db.execute(
                    text("""
                        INSERT INTO public.active_application_resumes (user_id, uploaded_resume_id, updated_at)
                        VALUES (:user_id, :resume_id, now())
                        ON CONFLICT (user_id) DO UPDATE SET
                            uploaded_resume_id = :resume_id,
                            studio_document_id = NULL,
                            updated_at = now();
                    """),
                    {"user_id": user_id, "resume_id": resume_id},
                )
        except Exception as e:
            logger.warning("active_application_resumes sync skipped or failed: %s", e)
            bind = getattr(db, "get_bind", lambda: None)()
            if bind and bind.dialect.name == "postgresql":
                raise

    @staticmethod
    def _clear_active_application_resume_pointer(
        db: Session, user_id: uuid.UUID
    ) -> None:
        """Clear active pointer from active_application_resumes table."""
        try:
            bind = db.get_bind()
            if bind and bind.dialect.name == "postgresql":
                db.execute(
                    text("DELETE FROM public.active_application_resumes WHERE user_id = :user_id"),
                    {"user_id": user_id},
                )
        except Exception as e:
            logger.warning("active_application_resumes clear skipped or failed: %s", e)
            bind = getattr(db, "get_bind", lambda: None)()
            if bind and bind.dialect.name == "postgresql":
                raise

    @staticmethod
    async def upload_and_create_resume(
        db: Session, user_id: uuid.UUID, file: UploadFile
    ) -> Resume:
        """Upload a new PDF resume, store physically, verify document, and activate."""
        # 1. Validate content type and file metadata
        if file.content_type not in ["application/pdf", "application/x-pdf"] and not (file.filename and file.filename.lower().endswith(".pdf")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are accepted for resumes.",
            )

        content = await file.read()
        file_size = len(content)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowed limit of 10 MB.",
            )

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        # Basic PDF signature check
        if not content.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PDF file structure. File header is missing or corrupted.",
            )

        # 2. Determine version
        max_ver_stmt = select(func.max(Resume.version)).where(Resume.user_id == user_id)
        current_max_ver = db.execute(max_ver_stmt).scalar() or 0
        new_version = current_max_ver + 1

        clean_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename or "resume.pdf")
        resume_id = uuid.uuid4()
        storage_path = f"resumes/{user_id}/{resume_id}_{clean_filename}"

        # 3. Physical Storage (fail-closed: storage must succeed)
        local_saved = save_local_resume_bytes(user_id, resume_id, content)
        supabase_saved = False
        supabase = get_supabase_client()
        if supabase:
            try:
                supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).upload(
                    path=storage_path,
                    file=content,
                    file_options={"content-type": "application/pdf"},
                )
                supabase_saved = True
            except Exception as e:
                logger.warning(f"Supabase storage upload failed: {e}")

        if not local_saved and not supabase_saved:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Physical storage failure: could not persist resume file to storage provider.",
            )

        # 4. Parse resume text and metadata
        parsed_data = None
        parsed_text = None
        try:
            parsed_data = ResumeParser.parse_pdf(content)
            parsed_text = ResumeParser.extract_text(content)
        except Exception as e:
            logger.warning("PDF text extraction warning: %s", e)

        # 5. Insert unverified draft resume record into DB transaction
        resume = Resume(
            id=resume_id,
            user_id=user_id,
            file_name=file.filename or "resume.pdf",
            storage_path=storage_path,
            version=new_version,
            is_active=False,  # Unverified: NOT active yet
            is_valid_document=False,
            document_status="pending_verification",
            file_mime_type="application/pdf",
            parsed_text=parsed_text,
            parsed_data=parsed_data,
        )
        db.add(resume)
        db.flush()

        # 6. Invoke ResumeVerificationService to verify physical storage & parseability (without auto-commit to preserve caller transaction)
        is_valid, doc_status = ResumeVerificationService.verify_resume_document(db, user_id, resume_id, auto_commit=False)
        if not is_valid:
            db.rollback()
            try:
                local_path = get_local_resume_path(user_id, resume_id)
                if local_path.is_file():
                    local_path.unlink()
            except Exception:
                pass
            if supabase_saved and supabase:
                try:
                    supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).remove([storage_path])
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Uploaded resume failed verification: {doc_status}.",
            )

        # 7. Verification succeeded: activate resume and synchronize active pointers
        db.execute(
            update(Resume)
            .where(Resume.user_id == user_id, Resume.id != resume_id)
            .values(is_active=False)
        )
        resume.is_active = True
        ResumeService._sync_active_application_resume_pointer(db, user_id, resume_id)
        db.commit()
        db.refresh(resume)
        return resume

    @staticmethod
    def get_resumes(db: Session, user_id: uuid.UUID) -> List[Resume]:
        from backend.app.services.resume_verification_service import ResumeVerificationService

        # On-access verification for any legacy pending resumes
        ResumeVerificationService.verify_all_pending_resumes(db, user_id)

        stmt = (
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(Resume.version.desc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_resume_by_id(
        db: Session, user_id: uuid.UUID, resume_id: uuid.UUID
    ) -> Optional[Resume]:
        stmt = select(Resume).where(
            Resume.id == resume_id, Resume.user_id == user_id
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_resume_bytes(
        db: Session, user_id: uuid.UUID, resume_id: uuid.UUID
    ) -> Tuple[bytes, str]:
        """Fetch the PDF binary bytes of a user resume. Fail-closed: never generate fake placeholder PDFs."""
        resume = ResumeService.get_resume_by_id(db, user_id, resume_id)
        if not resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found",
            )

        # 1. Attempt local disk retrieval
        local_path = get_local_resume_path(user_id, resume.id)
        if local_path.is_file():
            try:
                data = local_path.read_bytes()
                if data and len(data) > 0:
                    return data, resume.file_name
            except Exception:
                pass

        # 2. Attempt Supabase Storage retrieval
        supabase = get_supabase_client()
        if supabase and resume.storage_path:
            try:
                data = supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).download(resume.storage_path)
                if data and len(data) > 0:
                    # Cache locally for subsequent preview requests
                    save_local_resume_bytes(user_id, resume.id, data)
                    return data, resume.file_name
            except Exception:
                pass

        # 3. Fail-closed: Missing physical storage file
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume file '{resume.file_name}' not found in physical storage.",
        )

    @staticmethod
    def compute_profile_diff(
        profile: Profile,
        parsed_data: Dict[str, Any],
        existing_skills: List[Skill],
        existing_exps: List[Experience],
        existing_edus: List[Education],
    ) -> ProfileSyncDiff:
        """Compare extracted resume data against current profile, detecting additions, conflicts, and preserved fields."""
        fields_updated: Dict[str, Dict[str, Any]] = {}
        conflicts: List[ConflictField] = []
        preserved_fields: List[str] = []

        field_labels = {
            "first_name": "First Name",
            "last_name": "Last Name",
            "phone": "Phone Number",
            "city": "City",
            "country": "Country",
            "headline": "Professional Headline",
            "target_role": "Target Role",
            "about": "Summary / About",
            "linkedin_url": "LinkedIn Profile URL",
            "github_url": "GitHub Profile URL",
            "website_url": "Portfolio / Personal Website",
            "experience_years": "Total Experience Years",
        }

        # Compare scalar profile fields
        for field, label in field_labels.items():
            curr_val = getattr(profile, field, None)
            new_val = parsed_data.get(field)

            # Normalization
            curr_norm = str(curr_val).strip() if curr_val is not None else ""
            new_norm = str(new_val).strip() if new_val is not None else ""

            if curr_norm and new_norm:
                if curr_norm.lower() != new_norm.lower():
                    conflicts.append(
                        ConflictField(
                            field=field,
                            label=label,
                            current_value=curr_val,
                            extracted_value=new_val,
                            description=f"Current profile has '{curr_val}', while new resume contains '{new_val}'.",
                        )
                    )
            elif not curr_norm and new_norm:
                # Safe non-destructive enhancement
                fields_updated[field] = {"old": None, "new": new_val}
            elif curr_norm and not new_norm:
                # Existing value preserved because replacement doesn't provide evidence
                preserved_fields.append(field)

        # Manually configured preference fields are always preserved
        for pref in ["notice_period_days", "current_ctc", "expected_ctc", "authorized_to_work", "willing_to_relocate"]:
            val = getattr(profile, pref, None)
            if val is not None:
                preserved_fields.append(pref)

        # Skills comparison
        existing_skill_set = {s.name.strip().lower() for s in existing_skills if s.name}
        extracted_skills = parsed_data.get("skills", [])
        skills_to_add: List[str] = []
        for sk in extracted_skills:
            skill_name = sk.get("name") if isinstance(sk, dict) else sk
            if isinstance(skill_name, str) and skill_name.strip():
                if skill_name.strip().lower() not in existing_skill_set:
                    skills_to_add.append(skill_name.strip())

        # Experiences comparison
        existing_exp_set = {
            (e.company_name.strip().lower(), e.job_title.strip().lower())
            for e in existing_exps
            if e.company_name and e.job_title
        }
        extracted_exps = parsed_data.get("experiences", [])
        experiences_to_add: List[Dict[str, Any]] = []
        for exp in extracted_exps:
            c_name = (exp.get("company_name") or "").strip()
            j_title = (exp.get("job_title") or "").strip()
            if c_name and j_title:
                pair = (c_name.lower(), j_title.lower())
                if pair not in existing_exp_set:
                    experiences_to_add.append(exp)

        # Educations comparison
        existing_edu_set = {
            e.institution.strip().lower()
            for e in existing_edus
            if e.institution
        }
        extracted_edus = parsed_data.get("educations", [])
        educations_to_add: List[Dict[str, Any]] = []
        for edu in extracted_edus:
            inst = (edu.get("institution") or "").strip()
            if inst:
                if inst.lower() not in existing_edu_set:
                    educations_to_add.append(edu)

        return ProfileSyncDiff(
            fields_updated=fields_updated,
            skills_to_add=skills_to_add,
            experiences_to_add=experiences_to_add,
            educations_to_add=educations_to_add,
            conflicts=conflicts,
            preserved_fields=list(set(preserved_fields)),
        )

    @staticmethod
    async def replace_and_parse_resume(
        db: Session,
        user_id: uuid.UUID,
        file: UploadFile,
    ) -> ResumeReplacementResponse:
        """Upload a replacement resume, verify physical storage & parseability, create draft version, and parse/diff."""
        # 1. Validation
        if file.content_type not in ["application/pdf", "application/x-pdf"] and not (file.filename and file.filename.lower().endswith(".pdf")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are accepted for resumes.",
            )

        content = await file.read()
        file_size = len(content)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowed limit of 10 MB.",
            )

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        # Magic header check
        if not content.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PDF file structure. File header is missing or corrupted.",
            )

        # 2. Determine new version
        max_ver_stmt = select(func.max(Resume.version)).where(Resume.user_id == user_id)
        current_max_ver = db.execute(max_ver_stmt).scalar() or 0
        new_version = current_max_ver + 1

        # Locate existing active resume
        active_resume = ResumeService.get_active_resume(db, user_id)
        previous_active_id = active_resume.id if active_resume else None

        # 3. Physical Storage (fail-closed)
        resume_id = uuid.uuid4()
        clean_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename or "replacement_resume.pdf")
        storage_path = f"resumes/{user_id}/{resume_id}_{clean_filename}"
        local_saved = save_local_resume_bytes(user_id, resume_id, content)

        supabase_saved = False
        supabase = get_supabase_client()
        if supabase:
            try:
                supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).upload(
                    path=storage_path,
                    file=content,
                    file_options={"content-type": "application/pdf"},
                )
                supabase_saved = True
            except Exception as e:
                logger.warning(f"Supabase upload failed: {e}")

        if not local_saved and not supabase_saved:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Physical storage failure: could not persist replacement resume file.",
            )

        # 4. Create new resume version — strictly inactive draft
        new_resume = Resume(
            id=resume_id,
            user_id=user_id,
            file_name=file.filename or "replacement_resume.pdf",
            storage_path=storage_path,
            version=new_version,
            is_active=False,  # CRITICAL: keep existing active resume untouched
            is_valid_document=False,
            document_status="pending_verification",
            file_mime_type="application/pdf",
        )
        db.add(new_resume)
        db.flush()

        # 5. Invoke ResumeVerificationService to verify physical storage and PDF structure (without auto-commit)
        is_valid, doc_status = ResumeVerificationService.verify_resume_document(db, user_id, resume_id, auto_commit=False)
        if not is_valid:
            db.rollback()
            try:
                local_path = get_local_resume_path(user_id, resume_id)
                if local_path.is_file():
                    local_path.unlink()
            except Exception:
                pass
            if supabase_saved and supabase:
                try:
                    supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).remove([storage_path])
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Replacement resume failed verification: {doc_status}.",
            )

        # 6. Parse resume structure and text
        parsed_data = {}
        parsed_text = None
        try:
            parsed_data = ResumeParser.parse_pdf(content)
            parsed_text = ResumeParser.extract_text(content)
        except Exception as e:
            db.rollback()
            try:
                local_path = get_local_resume_path(user_id, resume_id)
                if local_path.is_file():
                    local_path.unlink()
            except Exception:
                pass
            if supabase_saved and supabase:
                try:
                    supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).remove([storage_path])
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unable to parse candidate resume: {str(e)}",
            )

        new_resume.parsed_data = parsed_data
        new_resume.parsed_text = parsed_text

        # 7. Fetch profile and compute diff
        profile = db.execute(select(Profile).where(Profile.id == user_id)).scalar_one_or_none()
        if not profile:
            profile = Profile(id=user_id)
            db.add(profile)
            db.flush()

        existing_skills = list(db.execute(select(Skill).where(Skill.user_id == user_id)).scalars().all())
        existing_exps = list(db.execute(select(Experience).where(Experience.user_id == user_id)).scalars().all())
        existing_edus = list(db.execute(select(Education).where(Education.user_id == user_id)).scalars().all())

        diff = ResumeService.compute_profile_diff(
            profile, parsed_data, existing_skills, existing_exps, existing_edus
        )

        db.commit()
        db.refresh(new_resume)

        return ResumeReplacementResponse(
            new_resume=ResumeResponse.model_validate(new_resume),
            previous_active_resume_id=previous_active_id,
            diff=diff,
            has_conflicts=len(diff.conflicts) > 0,
            status="parsed_awaiting_confirmation" if len(diff.conflicts) > 0 else "ready_to_activate",
        )

    @staticmethod
    def activate_resume_and_sync_profile(
        db: Session,
        user_id: uuid.UUID,
        resume_id: uuid.UUID,
        payload: ResumeActivationRequest,
    ) -> ResumeActivationResponse:
        """Activate the replacement resume version and apply candidate profile updates."""
        with _get_user_activation_lock(user_id):
            bind = db.get_bind()
            if bind and bind.dialect.name == "postgresql":
                # PostgreSQL transaction-level advisory lock serializes concurrent activations per user across all workers/processes
                db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:uid))"), {"uid": str(user_id)})

            resume = ResumeService.get_resume_by_id(db, user_id, resume_id)
            if not resume:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Resume not found",
                )

            # Explicit server-side verification check: ONLY verified resumes may be activated
            if not resume.is_valid_document or resume.document_status != "verified":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot activate unverified resume '{resume.id}' (status: '{resume.document_status}', valid: {resume.is_valid_document}). Only verified resumes can be activated.",
                )

            profile = db.execute(select(Profile).where(Profile.id == user_id)).scalar_one_or_none()
            if not profile:
                profile = Profile(id=user_id)
                db.add(profile)
                db.flush()

            parsed_data = resume.parsed_data or {}

            # Identify previous active resume to track record provenance
            previous_active = db.execute(
                select(Resume)
                .where(Resume.user_id == user_id, Resume.is_active == True, Resume.id != resume.id)
                .order_by(Resume.version.desc())
            ).scalars().first()
            prev_parsed = (previous_active.parsed_data or {}) if previous_active else {}

            try:
                # 1. Reconcile scalar profile fields
                resume_fields = [
                    "first_name", "last_name", "phone", "city", "country",
                    "headline", "target_role", "about", "linkedin_url", "github_url", "website_url"
                ]

                for field in resume_fields:
                    if payload.accepted_fields and field in payload.accepted_fields:
                        # Explicit candidate override (e.g. Keep Current or Apply New)
                        setattr(profile, field, payload.accepted_fields[field])
                    else:
                        new_val = parsed_data.get(field)
                        curr_val = getattr(profile, field, None)
                        prev_val = prev_parsed.get(field)

                        if new_val:
                            setattr(profile, field, new_val)
                        elif getattr(payload, "clear_stale_fields", False):
                            # Provenance check: If curr_val matches what Resume A provided, it is a stale resume-derived field
                            if curr_val and prev_val and str(curr_val).strip() == str(prev_val).strip():
                                setattr(profile, field, None)

                if payload.accepted_fields and "experience_years" in payload.accepted_fields:
                    profile.experience_years = payload.accepted_fields["experience_years"]
                elif parsed_data.get("experience_years") is not None:
                    profile.experience_years = parsed_data["experience_years"]

                # 2. Reconcile Skills with Provenance
                if payload.add_skills:
                    raw_skills = parsed_data.get("skills", [])
                    extracted_skills = []
                    for sk in raw_skills:
                        s_name = sk.get("name") if isinstance(sk, dict) else sk
                        if isinstance(s_name, str) and s_name.strip():
                            extracted_skills.append(s_name.strip())

                    # De-duplicate incoming
                    seen_new_skills = set()
                    deduped_new_skills = []
                    for sk in extracted_skills:
                        if sk.lower() not in seen_new_skills:
                            seen_new_skills.add(sk.lower())
                            deduped_new_skills.append(sk)

                    raw_prev_skills = prev_parsed.get("skills", [])
                    prev_skills = set()
                    for ps in raw_prev_skills:
                        ps_name = ps.get("name") if isinstance(ps, dict) else ps
                        if isinstance(ps_name, str) and ps_name.strip():
                            prev_skills.add(ps_name.strip().lower())

                    existing_skills = list(db.execute(select(Skill).where(Skill.user_id == user_id)).scalars().all())
                    existing_by_lower = {s.name.strip().lower(): s for s in existing_skills if s.name}

                    # Add new skills
                    for proper_name in deduped_new_skills:
                        lower_name = proper_name.lower()
                        if lower_name not in existing_by_lower:
                            db.add(Skill(user_id=user_id, name=proper_name))

                    # Safe Provenance Pruning:
                    # Remove an existing skill ONLY IF it was extracted from Resume A (in prev_skills)
                    # and is absent from Resume B, provided the candidate didn't manually configure it (years/months > 0).
                    # Manually added skills (NOT in prev_skills) are ALWAYS PRESERVED!
                    for lower_name, s in existing_by_lower.items():
                        if lower_name not in seen_new_skills:
                            if lower_name in prev_skills and s.years == 0 and s.months == 0:
                                db.delete(s)

                # 3. Reconcile Experiences with Provenance & Multi-Period Support
                if payload.add_experiences:
                    from backend.app.api.profile_extraction import _parse_date

                    def _normalize_company(name: str) -> str:
                        c = (name or "").strip().lower()
                        c_clean = re.sub(r"\b(llc|inc\.?|ltd\.?|corp\.?|corporation|technologies|solutions|services)\b", "", c).strip(",. ")
                        return c_clean if c_clean else c

                    def _exp_matches(e1: Dict[str, Any] | Experience, e2: Dict[str, Any] | Experience) -> bool:
                        c1 = _normalize_company(getattr(e1, "company_name", None) or (e1.get("company_name", "") if isinstance(e1, dict) else ""))
                        c2 = _normalize_company(getattr(e2, "company_name", None) or (e2.get("company_name", "") if isinstance(e2, dict) else ""))
                        if not c1 or not c2 or c1 != c2:
                            return False

                        t1 = (getattr(e1, "job_title", None) or (e1.get("job_title", "") if isinstance(e1, dict) else "")).strip().lower()
                        t2 = (getattr(e2, "job_title", None) or (e2.get("job_title", "") if isinstance(e2, dict) else "")).strip().lower()
                        if not t1 or not t2 or t1 != t2:
                            return False

                        s1 = getattr(e1, "start_date", None) or (e1.get("start_date") if isinstance(e1, dict) else None)
                        s2 = getattr(e2, "start_date", None) or (e2.get("start_date") if isinstance(e2, dict) else None)
                        if s1 and s2:
                            return str(s1)[:7] == str(s2)[:7]
                        return True

                    extracted_exps = parsed_data.get("experiences", [])

                    # De-duplicate incoming records
                    deduped_exps = []
                    for exp in extracted_exps:
                        if not exp.get("company_name") or not exp.get("job_title"):
                            continue
                        if not any(_exp_matches(exp, d) for d in deduped_exps):
                            deduped_exps.append(exp)

                    prev_exps = [e for e in prev_parsed.get("experiences", []) if e.get("company_name") and e.get("job_title")]
                    existing_exps = list(db.execute(select(Experience).where(Experience.user_id == user_id)).scalars().all())
                    retained_exp_ids = set()

                    for exp in deduped_exps:
                        c_name = (exp.get("company_name") or "").strip()
                        j_title = (exp.get("job_title") or "").strip()
                        s_date = _parse_date(exp.get("start_date"))
                        e_date = _parse_date(exp.get("end_date"))
                        desc = exp.get("description")

                        matched_existing = next((e for e in existing_exps if e.id not in retained_exp_ids and _exp_matches(e, exp)), None)
                        if matched_existing:
                            matched_existing.company_name = c_name
                            matched_existing.job_title = j_title
                            matched_existing.start_date = s_date
                            matched_existing.end_date = e_date
                            matched_existing.description = desc
                            retained_exp_ids.add(matched_existing.id)
                        else:
                            new_item = Experience(
                                user_id=user_id,
                                company_name=c_name,
                                job_title=j_title,
                                start_date=s_date,
                                end_date=e_date,
                                description=desc,
                            )
                            db.add(new_item)

                    # Provenance Check for Deletion:
                    # Delete an existing experience ONLY IF it belonged to Resume A (matches prev_exps)
                    # and is not in Resume B. Manually added experiences (NOT in prev_exps) ARE PRESERVED!
                    for e in existing_exps:
                        if e.id not in retained_exp_ids:
                            if any(_exp_matches(e, pe) for pe in prev_exps):
                                db.delete(e)

                # 4. Reconcile Educations with Provenance & Multi-Degree Support
                if payload.add_educations:
                    def _edu_matches(e1: Dict[str, Any] | Education, e2: Dict[str, Any] | Education) -> bool:
                        i1 = (getattr(e1, "institution", None) or (e1.get("institution", "") if isinstance(e1, dict) else "")).strip().lower()
                        i2 = (getattr(e2, "institution", None) or (e2.get("institution", "") if isinstance(e2, dict) else "")).strip().lower()
                        if not i1 or not i2 or i1 != i2:
                            return False
                        d1 = (getattr(e1, "degree", None) or (e1.get("degree", "") if isinstance(e1, dict) else "")).strip().lower()
                        d2 = (getattr(e2, "degree", None) or (e2.get("degree", "") if isinstance(e2, dict) else "")).strip().lower()
                        if d1 and d2 and d1 != d2:
                            return False
                        f1 = (getattr(e1, "field_of_study", None) or (e1.get("field_of_study", "") if isinstance(e1, dict) else "")).strip().lower()
                        f2 = (getattr(e2, "field_of_study", None) or (e2.get("field_of_study", "") if isinstance(e2, dict) else "")).strip().lower()
                        if f1 and f2 and f1 != f2:
                            return False
                        return True

                    extracted_edus = parsed_data.get("educations", [])

                    # De-duplicate incoming
                    deduped_edus = []
                    for edu in extracted_edus:
                        if not edu.get("institution"):
                            continue
                        if not any(_edu_matches(edu, d) for d in deduped_edus):
                            deduped_edus.append(edu)

                    prev_edus = [ed for ed in prev_parsed.get("educations", []) if ed.get("institution")]
                    existing_edus = list(db.execute(select(Education).where(Education.user_id == user_id)).scalars().all())
                    retained_edu_ids = set()

                    for edu in deduped_edus:
                        inst = (edu.get("institution") or "").strip()
                        deg = edu.get("degree")
                        fos = edu.get("field_of_study")
                        s_year = edu.get("start_year")
                        e_year = edu.get("end_year")
                        desc = edu.get("description")

                        matched_existing = next((e for e in existing_edus if e.id not in retained_edu_ids and _edu_matches(e, edu)), None)
                        if matched_existing:
                            matched_existing.degree = deg
                            matched_existing.field_of_study = fos
                            matched_existing.start_year = s_year
                            matched_existing.end_year = e_year
                            matched_existing.description = desc
                            retained_edu_ids.add(matched_existing.id)
                        else:
                            new_item = Education(
                                user_id=user_id,
                                institution=inst,
                                degree=deg,
                                field_of_study=fos,
                                start_year=s_year,
                                end_year=e_year,
                                description=desc,
                            )
                            db.add(new_item)

                    # Provenance Check for Deletion:
                    # Delete an existing education ONLY IF it belonged to Resume A (matches prev_edus).
                    # Manually added educations (NOT in prev_edus) ARE PRESERVED!
                    for ed in existing_edus:
                        if ed.id not in retained_edu_ids:
                            if any(_edu_matches(ed, pe) for pe in prev_edus):
                                db.delete(ed)

                # 5. Atomically deactivate other resumes and activate the replacement
                db.execute(
                    update(Resume)
                    .where(Resume.user_id == user_id, Resume.id != resume.id)
                    .values(is_active=False)
                )
                resume.is_active = True

                # Synchronize active_application_resumes table
                ResumeService._sync_active_application_resume_pointer(db, user_id, resume.id)

                db.commit()
                db.refresh(resume)
                db.refresh(profile)
            except Exception:
                db.rollback()
                raise

            return ResumeActivationResponse(
                resume=ResumeResponse.model_validate(resume),
                message=f"Resume v{resume.version} activated and candidate profile synchronized successfully.",
                profile_updated=True,
            )

    @staticmethod
    def delete_resume(
        db: Session, user_id: uuid.UUID, resume_id: uuid.UUID
    ) -> bool:
        """Delete resume record, clean physical storage, and fallback active pointer if needed."""
        resume = ResumeService.get_resume_by_id(db, user_id, resume_id)
        if not resume:
            return False

        was_active = resume.is_active

        # Attempt to delete from Supabase storage
        supabase = get_supabase_client()
        if supabase and resume.storage_path:
            try:
                supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).remove([resume.storage_path])
            except Exception:
                pass

        # Attempt to delete local disk file
        try:
            local_path = get_local_resume_path(user_id, resume.id)
            if local_path.is_file():
                local_path.unlink()
        except Exception:
            pass

        db.delete(resume)
        db.flush()

        # If deleted resume was active, fallback to next most recent verified resume
        if was_active:
            candidates = db.execute(
                select(Resume)
                .where(
                    Resume.user_id == user_id,
                    Resume.is_valid_document == True,
                    Resume.document_status == "verified",
                )
                .order_by(Resume.version.desc())
            ).scalars().all()

            fallback = None
            for cand in candidates:
                is_valid, _ = ResumeVerificationService.verify_resume_document(db, user_id, cand.id, auto_commit=False)
                if is_valid:
                    fallback = cand
                    break

            if fallback:
                fallback.is_active = True
                ResumeService._sync_active_application_resume_pointer(db, user_id, fallback.id)
            else:
                ResumeService._clear_active_application_resume_pointer(db, user_id)

        db.commit()
        return True

    @staticmethod
    def get_active_resume(db: Session, user_id: uuid.UUID) -> Optional[Resume]:
        """Fetch currently active verified resume for user, performing on-access verification if needed."""
        stmt = (
            select(Resume)
            .where(
                Resume.user_id == user_id,
                Resume.is_active == True,
                Resume.is_valid_document == True,
                Resume.document_status == "verified",
            )
            .order_by(Resume.version.desc())
        )
        active = db.execute(stmt).scalars().first()
        if not active:
            # On-access check for legacy pending resume claiming is_active
            pending_stmt = (
                select(Resume)
                .where(
                    Resume.user_id == user_id,
                    Resume.is_active == True,
                    Resume.document_status == "pending_verification",
                )
                .order_by(Resume.version.desc())
            )
            pending = db.execute(pending_stmt).scalars().first()
            if pending:
                from backend.app.services.resume_verification_service import ResumeVerificationService
                is_valid, _ = ResumeVerificationService.verify_resume_document(db, user_id, pending.id, auto_commit=True)
                if is_valid:
                    return pending
                else:
                    pending.is_active = False
                    db.commit()
            return None
        return active
