"""API endpoints for automated profile extraction from resumes and portfolios, review, and application."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.api.policy import require_policy_accepted
from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.profile import ProfileResponse
from backend.app.schemas.profile_extraction import (
    ApplyExtractionRequest,
    ProfileExtractionResult,
)
from backend.app.services.extraction_merger import ExtractionMerger
from backend.app.services.portfolio_extractor import PortfolioExtractor, validate_safe_url
from backend.app.services.profile_service import ProfileService
from backend.app.services.resume_parser import ResumeParser
from backend.app.services.resume_service import ResumeService

router = APIRouter(
    prefix="/profile",
    tags=["Profile Extraction"],
    dependencies=[Depends(require_policy_accepted)],
)


@router.post("/extract", response_model=ProfileExtractionResult, status_code=status.HTTP_200_OK)
async def extract_profile_data(
    resume: Optional[UploadFile] = File(None),
    portfolio_url: Optional[str] = Form(None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Extract structured profile data from an uploaded PDF resume and/or public portfolio URL."""
    if not resume and not portfolio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least a resume file or a portfolio URL to extract.",
        )

    resume_data = None
    portfolio_data = None
    warnings = []

    # 1. Process Resume if provided (Single source: mutually exclusive with portfolio URL)
    if resume and resume.filename:
        # Validate format
        if not (resume.filename.lower().endswith(".pdf") or resume.content_type in ["application/pdf", "application/x-pdf"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported resume file format. Only PDF files are supported.",
            )

        resume_bytes = await resume.read()
        if len(resume_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Resume file exceeds 10 MB maximum size limit.",
            )

        if len(resume_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded resume file is empty.",
            )

        # Parse PDF text & structure
        resume_data = ResumeParser.parse_pdf(resume_bytes)

    # 2. Process Public URL if provided (only when resume is not provided)
    elif portfolio_url and portfolio_url.strip():
        cleaned_url = portfolio_url.strip()
        try:
            # Validate URL with SSRF protection
            validate_safe_url(cleaned_url)
            portfolio_data = await PortfolioExtractor.extract_from_url(cleaned_url)
        except ValueError as exc:
            warnings.append(f"Portfolio extraction notice: {exc}")
        except Exception as exc:
            warnings.append(f"Unable to extract from portfolio URL: {exc}")

    # 3. Merge extractions with source attribution & conflict detection
    result = ExtractionMerger.merge(resume_data, portfolio_data)
    for w in warnings:
        result.warnings.append(w)

    return result


def _parse_date(val: Optional[str | date]) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, date):
        return val
    if not isinstance(val, str):
        return None
    val = val.strip()
    if not val:
        return None
    try:
        return date.fromisoformat(val)
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y/%m/%d", "%b %Y", "%B %Y", "%m/%Y", "%Y"):
        try:
            return datetime.strptime(val, fmt).date()
        except Exception:
            continue
    return None


@router.post("/apply-extraction", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
def apply_extracted_profile(
    payload: ApplyExtractionRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Apply confirmed profile, experiences, skills, and educations to the user account."""
    profile = ProfileService.get_or_create_profile(db, user_id)

    # 1. Update Profile Fields
    p = payload.profile
    if p.first_name and p.first_name.strip():
        profile.first_name = p.first_name.strip()
    if p.last_name and p.last_name.strip():
        profile.last_name = p.last_name.strip()
    if p.phone and p.phone.strip():
        profile.phone = p.phone.strip()
    if p.city and p.city.strip():
        profile.city = p.city.strip()
    if p.state and p.state.strip():
        profile.state = p.state.strip()
    if p.country and p.country.strip():
        profile.country = p.country.strip()
    if p.headline and p.headline.strip():
        profile.headline = p.headline.strip()
    if p.target_role and p.target_role.strip():
        profile.target_role = p.target_role.strip()
    if p.about and p.about.strip():
        profile.about = p.about.strip()
    if p.linkedin_url and p.linkedin_url.strip():
        profile.linkedin_url = p.linkedin_url.strip()
    if p.github_url and p.github_url.strip():
        profile.github_url = p.github_url.strip()
    if p.website_url and p.website_url.strip():
        profile.website_url = p.website_url.strip()
    if p.experience_years is not None and p.experience_years >= 0:
        profile.experience_years = p.experience_years
    if p.experience_months is not None and p.experience_months >= 0:
        profile.experience_months = p.experience_months
    if p.notice_period_days is not None and p.notice_period_days >= 0:
        profile.notice_period_days = p.notice_period_days
    if p.expected_ctc is not None and p.expected_ctc >= 0:
        profile.expected_ctc = p.expected_ctc

    if payload.complete_onboarding:
        from datetime import datetime, timezone
        profile.onboarding_completed = True
        profile.onboarding_completed_at = datetime.now(timezone.utc)

        # Initialize default SearchConfig if missing
        from backend.app.db.models.search_config import SearchConfig
        cfg = db.execute(select(SearchConfig).where(SearchConfig.user_id == user_id)).scalar_one_or_none()
        if not cfg and profile.target_role:
            new_cfg = SearchConfig(
                user_id=user_id,
                keywords=profile.target_role,
                location=profile.city or profile.country or "India",
            )
            db.add(new_cfg)

    db.commit()

    # 2. Add Skills (Batch single-commit)
    if payload.skills:
        from backend.app.schemas.profile import SkillCreate
        skills_to_add = [
            SkillCreate(name=s.name, years=s.years, months=s.months)
            for s in payload.skills
            if s.name and s.name.strip()
        ]
        if skills_to_add:
            ProfileService.add_skills(db, user_id, skills_to_add)

    # 3. Add Experiences (Batch single-commit)
    if payload.experiences:
        from backend.app.db.models.experience import Experience
        existing_exps = db.execute(
            select(Experience).where(Experience.user_id == user_id)
        ).scalars().all()
        existing_exp_set = {
            (e.company_name.strip().lower(), e.job_title.strip().lower())
            for e in existing_exps
            if e.company_name and e.job_title
        }
        has_new_exp = False
        for exp in payload.experiences:
            c_name = (exp.company_name or "").strip()
            j_title = (exp.job_title or "").strip()
            if c_name and j_title:
                pair = (c_name.lower(), j_title.lower())
                if pair not in existing_exp_set:
                    db.add(
                        Experience(
                            user_id=user_id,
                            company_name=c_name,
                            job_title=j_title,
                            start_date=_parse_date(exp.start_date),
                            end_date=_parse_date(exp.end_date),
                            description=exp.description,
                        )
                    )
                    existing_exp_set.add(pair)
                    has_new_exp = True
        if has_new_exp:
            db.commit()

    # 4. Add Educations (Batch single-commit)
    if payload.educations:
        from backend.app.db.models.education import Education
        existing_edus = db.execute(
            select(Education).where(Education.user_id == user_id)
        ).scalars().all()
        existing_edu_set = {
            e.institution.strip().lower()
            for e in existing_edus
            if e.institution
        }
        has_new_edu = False
        for edu in payload.educations:
            inst = (edu.institution or "").strip()
            if inst:
                inst_lower = inst.lower()
                if inst_lower not in existing_edu_set:
                    db.add(
                        Education(
                            user_id=user_id,
                            institution=inst,
                            degree=edu.degree,
                            field_of_study=edu.field_of_study,
                            start_year=edu.start_year,
                            end_year=edu.end_year,
                            description=edu.description,
                        )
                    )
                    existing_edu_set.add(inst_lower)
                    has_new_edu = True
        if has_new_edu:
            db.commit()

    return ProfileService.get_or_create_profile(db, user_id)
