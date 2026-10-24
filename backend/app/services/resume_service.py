"""Resume service for uploading, parsing, versioning, and managing user resumes."""

import io
import re
import uuid
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, UploadFile, status
import pdfplumber
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from supabase import Client, create_client

from backend.app.core.config import settings
from backend.app.db.models.resume import Resume

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def get_supabase_client() -> Optional[Client]:
    """Get Supabase client with service role key for storage operations if configured."""
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    elif settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return None


def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using pdfplumber."""
    extracted_text = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                extracted_text.append(text)
    return "\n\n".join(extracted_text)


def parse_resume_structure(text: str) -> Dict[str, Any]:
    """Extract structured data hints from resume text."""
    parsed: Dict[str, Any] = {
        "emails": [],
        "phones": [],
        "skills_detected": [],
        "word_count": len(text.split()),
    }
    # Email regex
    emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    parsed["emails"] = list(set(emails))

    # Phone regex (international and local)
    phones = re.findall(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
    parsed["phones"] = list(set(phones))

    # Common tech keywords
    common_skills = [
        "python", "javascript", "typescript", "react", "fastapi", "django",
        "sql", "postgresql", "docker", "kubernetes", "aws", "playwright",
        "selenium", "selenium webdriver", "postman", "git", "ci/cd", "linux"
    ]
    text_lower = text.lower()
    for skill in common_skills:
        if re.search(r"\b" + re.escape(skill) + r"\b", text_lower):
            parsed["skills_detected"].append(skill)

    return parsed


class ResumeService:
    @staticmethod
    async def upload_and_create_resume(
        db: Session, user_id: uuid.UUID, file: UploadFile
    ) -> Resume:
        # Validate content type
        if file.content_type not in ["application/pdf", "application/x-pdf"] and not (file.filename and file.filename.lower().endswith(".pdf")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are accepted for resumes.",
            )

        # Read file content
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

        # Determine version
        max_ver_stmt = select(func.max(Resume.version)).where(Resume.user_id == user_id)
        current_max_ver = db.execute(max_ver_stmt).scalar() or 0
        new_version = current_max_ver + 1

        # Upload to Supabase Storage if configured
        clean_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename or "resume.pdf")
        storage_path = f"resumes/{user_id}/{uuid.uuid4()}_{clean_filename}"

        supabase = get_supabase_client()
        if supabase:
            try:
                supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).upload(
                    path=storage_path,
                    file=content,
                    file_options={"content-type": "application/pdf"},
                )
            except Exception:
                pass

        # Structured Candidate Onboarding: Uploading a PDF does not invoke resume parsing
        # or extract profile information. Candidate data comes exclusively from direct structured inputs.
        parsed_text = None
        parsed_data = None

        # Deactivate previous active resumes for this user
        db.execute(
            update(Resume)
            .where(Resume.user_id == user_id)
            .values(is_active=False)
        )

        resume = Resume(
            user_id=user_id,
            file_name=file.filename or "resume.pdf",
            storage_path=storage_path,
            version=new_version,
            is_active=True,
            parsed_text=parsed_text,
            parsed_data=parsed_data,
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)
        return resume

    @staticmethod
    def get_resumes(db: Session, user_id: uuid.UUID) -> List[Resume]:
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
    def delete_resume(
        db: Session, user_id: uuid.UUID, resume_id: uuid.UUID
    ) -> bool:
        resume = ResumeService.get_resume_by_id(db, user_id, resume_id)
        if not resume:
            return False

        # Attempt to delete from Supabase storage
        supabase = get_supabase_client()
        if supabase and resume.storage_path:
            try:
                supabase.storage.from_(settings.RESUME_STORAGE_BUCKET).remove([resume.storage_path])
            except Exception:
                pass

        db.delete(resume)
        db.commit()
        return True

    @staticmethod
    def get_active_resume(db: Session, user_id: uuid.UUID) -> Optional[Resume]:
        stmt = (
            select(Resume)
            .where(Resume.user_id == user_id, Resume.is_active == True)
            .order_by(Resume.version.desc())
        )
        return db.execute(stmt).scalars().first()
