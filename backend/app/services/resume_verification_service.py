"""Resume storage and document verification service.

Guarantees physical storage existence, PDF magic-bytes validation, and parseability.
Ensures legacy resumes and new uploads are verified by trusted backend code before
becoming eligible for active resume pointer assignment.
"""

from __future__ import annotations

import io
import logging
import uuid
from typing import Dict, Optional, Tuple
import pdfplumber
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.models.resume import Resume

logger = logging.getLogger("rolepilot.resume_verification")

PDF_MAGIC_BYTES = b"%PDF-"


class ResumeVerificationService:
    """Performs physical storage and content validation for candidate resumes."""

    @classmethod
    def verify_resume_document(
        cls,
        db: Session,
        user_id: uuid.UUID,
        resume_id: uuid.UUID,
        auto_commit: bool = True,
    ) -> Tuple[bool, str]:
        """Verify storage object existence, magic bytes, and parseability.

        Returns (is_valid: bool, document_status: str).
        Possible document_status values:
          - 'verified': Physical file exists, starts with %PDF-, and parses cleanly.
          - 'missing_storage': File not found in local disk or Supabase Storage.
          - 'unsupported_format': File does not begin with %PDF- header.
          - 'corrupt': File header is PDF, but parser failed to read pages/xref.
        """
        stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
        resume = db.execute(stmt).scalar_one_or_none()
        if not resume:
            return False, "not_found"

        if not resume.storage_path or not resume.storage_path.strip():
            cls._update_db_status(db, resume_id, False, "missing_storage", "unknown", auto_commit=auto_commit)
            return False, "missing_storage"

        # 1. Fetch physical bytes (local storage or Supabase Storage)
        file_bytes = cls._retrieve_file_bytes(user_id, resume_id, resume.storage_path)
        if file_bytes is None or len(file_bytes) == 0:
            logger.warning(
                "Resume %s for user %s missing from physical storage (path: %s)",
                resume_id,
                user_id,
                resume.storage_path,
            )
            cls._update_db_status(db, resume_id, False, "missing_storage", "unknown", auto_commit=auto_commit)
            return False, "missing_storage"

        # 2. Validate PDF magic bytes
        if not file_bytes.startswith(PDF_MAGIC_BYTES):
            detected_mime = "image/png" if file_bytes.startswith(b"\x89PNG") else "application/octet-stream"
            logger.warning(
                "Resume %s for user %s does not contain valid PDF magic bytes",
                resume_id,
                user_id,
            )
            cls._update_db_status(db, resume_id, False, "unsupported_format", detected_mime, auto_commit=auto_commit)
            return False, "unsupported_format"

        # 3. Validate parseability with pdfplumber
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                page_count = len(pdf.pages)
                if page_count == 0:
                    cls._update_db_status(db, resume_id, False, "corrupt", "application/pdf", auto_commit=auto_commit)
                    return False, "corrupt"
                # Touch first page to trigger raster/stream parsing
                _ = pdf.pages[0].extract_text()
        except Exception as parse_err:
            logger.warning(
                "Resume %s corrupted or unparseable: %s", resume_id, parse_err
            )
            cls._update_db_status(db, resume_id, False, "corrupt", "application/pdf", auto_commit=auto_commit)
            return False, "corrupt"

        # 4. Success: document verified
        cls._update_db_status(db, resume_id, True, "verified", "application/pdf", auto_commit=auto_commit)
        return True, "verified"

    @classmethod
    def _retrieve_file_bytes(
        cls,
        user_id: uuid.UUID,
        resume_id: uuid.UUID,
        storage_path: str,
    ) -> Optional[bytes]:
        """Try retrieving bytes from local filesystem first, then Supabase Storage."""
        from backend.app.services.resume_service import (
            get_local_resume_path,
            get_supabase_client,
        )

        # Check local disk
        local_path = get_local_resume_path(user_id, resume_id)
        if local_path.is_file():
            try:
                return local_path.read_bytes()
            except Exception:
                pass

        # Check Supabase Storage
        supabase = get_supabase_client()
        if supabase:
            try:
                bucket = getattr(settings, "RESUME_STORAGE_BUCKET", "resumes")
                res = supabase.storage.from_(bucket).download(storage_path)
                if res and len(res) > 0:
                    return res
            except Exception as e:
                logger.debug("Supabase storage download failed for %s: %s", storage_path, e)

        return None

    @classmethod
    def _update_db_status(
        cls,
        db: Session,
        resume_id: uuid.UUID,
        is_valid: bool,
        status_value: str,
        mime_type: str,
        auto_commit: bool = True,
    ) -> None:
        """Update validity metadata in the database."""
        # Using raw update statement to be compatible whether or not SQLAlchemy ORM model is mapped
        db.execute(
            update(Resume)
            .where(Resume.id == resume_id)
            .values(
                is_valid_document=is_valid,
                document_status=status_value,
                file_mime_type=mime_type,
            )
        )
        if auto_commit:
            db.commit()

    @classmethod
    def verify_all_pending_resumes(
        cls,
        db: Session,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, int]:
        """Verify all legacy or pending resumes in batch.

        Returns counts grouped by outcome status.
        """
        query = select(Resume.id, Resume.user_id).where(
            Resume.document_status == "pending_verification"
        )
        if user_id:
            query = query.where(Resume.user_id == user_id)

        rows = db.execute(query).all()
        summary = {
            "verified": 0,
            "missing_storage": 0,
            "corrupt": 0,
            "unsupported_format": 0,
        }

        for row in rows:
            _, outcome = cls.verify_resume_document(db, row.user_id, row.id)
            if outcome in summary:
                summary[outcome] += 1

        return summary

