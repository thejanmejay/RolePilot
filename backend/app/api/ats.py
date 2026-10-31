"""Public, free ATS Resume Checker API endpoint."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from backend.app.services.ats_service import ATSResumeAnalyzer

router = APIRouter(tags=["ATS Resume Checker"])

MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/resumes/ats-check")
@router.post("/ats/check")
async def check_resume_ats(
    file: UploadFile = File(...),
):
    """Analyze a PDF resume for ATS compatibility without requiring login or signup."""
    # Validate extension & content type
    filename = file.filename or "resume.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF format (.pdf) is supported for ATS analysis.",
        )

    # Read bytes safely with size cap
    content = await file.read()
    if len(content) > MAX_RESUME_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 5MB limit. Please upload a smaller PDF.",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty.",
        )

    # Run deterministic analysis
    result = ATSResumeAnalyzer.analyze_pdf(content, filename=filename)
    return result
