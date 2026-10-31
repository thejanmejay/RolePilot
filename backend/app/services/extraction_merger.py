"""Service for merging candidate resume and portfolio extractions with source attribution and conflict detection."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from backend.app.schemas.profile_extraction import (
    ExtractedEducation,
    ExtractedExperience,
    ExtractedProfileData,
    ExtractedSkill,
    ExtractionConflict,
    ProfileExtractionResult,
)


class ExtractionMerger:
    """Merges resume data and portfolio data, records source attribution, and detects conflicting values."""

    @classmethod
    def merge(
        cls,
        resume_data: Optional[Dict[str, Any]] = None,
        portfolio_data: Optional[Dict[str, Any]] = None,
    ) -> ProfileExtractionResult:
        sources: List[str] = []
        source_attribution: Dict[str, str] = {}
        conflicts: List[ExtractionConflict] = []
        warnings: List[str] = []
        is_readable = True

        if resume_data:
            sources.append("resume")
            if not resume_data.get("is_readable", True):
                is_readable = False
            for w in resume_data.get("warnings", []):
                warnings.append(w)

        if portfolio_data:
            sources.append("portfolio")

        # 1. Profile Field Resolution & Source Tracking
        first_name = None
        last_name = None
        if resume_data and resume_data.get("first_name"):
            first_name = resume_data["first_name"]
            last_name = resume_data.get("last_name")
            source_attribution["first_name"] = "resume"
            if last_name:
                source_attribution["last_name"] = "resume"
        elif portfolio_data and portfolio_data.get("first_name"):
            first_name = portfolio_data["first_name"]
            last_name = portfolio_data.get("last_name")
            source_attribution["first_name"] = "portfolio"
            if last_name:
                source_attribution["last_name"] = "portfolio"

        # Email & Phone (Resume takes precedence if present, fallback to portfolio)
        email = (resume_data or {}).get("email") or (portfolio_data or {}).get("email")
        if (resume_data or {}).get("email"):
            source_attribution["email"] = "resume"
        elif email:
            source_attribution["email"] = "portfolio"

        phone = (resume_data or {}).get("phone") or (portfolio_data or {}).get("phone")
        if (resume_data or {}).get("phone"):
            source_attribution["phone"] = "resume"
        elif phone:
            source_attribution["phone"] = "portfolio"

        city = (resume_data or {}).get("city") or (portfolio_data or {}).get("city")
        if (resume_data or {}).get("city"):
            source_attribution["city"] = "resume"
        elif city:
            source_attribution["city"] = "portfolio"

        country = (resume_data or {}).get("country") or (portfolio_data or {}).get("country") or "India"
        source_attribution["country"] = "resume" if resume_data else ("portfolio" if portfolio_data else "default")

        # Headline / Target Role & Conflict Detection
        resume_headline = (resume_data or {}).get("headline")
        port_headline = (portfolio_data or {}).get("headline")

        headline: Optional[str] = None
        target_role: Optional[str] = None

        if resume_headline and port_headline and resume_headline.strip().lower() != port_headline.strip().lower():
            # Flag conflict between resume and portfolio titles
            conflicts.append(
                ExtractionConflict(
                    field="headline",
                    resume_value=resume_headline,
                    portfolio_value=port_headline,
                    resolved_value=resume_headline,  # Default to resume, allow candidate to switch
                    source_options=["resume", "portfolio"],
                )
            )
            headline = resume_headline
            target_role = resume_headline
            source_attribution["headline"] = "conflict_review"
            source_attribution["target_role"] = "conflict_review"
        elif resume_headline:
            headline = resume_headline
            target_role = resume_headline
            source_attribution["headline"] = "resume"
            source_attribution["target_role"] = "resume"
        elif port_headline:
            headline = port_headline
            target_role = port_headline
            source_attribution["headline"] = "portfolio"
            source_attribution["target_role"] = "portfolio"

        # URLs (Resume takes precedence for candidate direct links)
        linkedin_url = (resume_data or {}).get("linkedin_url") or (portfolio_data or {}).get("linkedin_url")
        if linkedin_url:
            source_attribution["linkedin_url"] = "resume" if (resume_data or {}).get("linkedin_url") else "portfolio"

        github_url = (resume_data or {}).get("github_url") or (portfolio_data or {}).get("github_url")
        if github_url:
            source_attribution["github_url"] = "resume" if (resume_data or {}).get("github_url") else "portfolio"

        website_url = (portfolio_data or {}).get("website_url") or (resume_data or {}).get("website_url")
        if website_url:
            source_attribution["website_url"] = "portfolio" if (portfolio_data or {}).get("website_url") else "resume"

        experience_years = (resume_data or {}).get("experience_years") or (portfolio_data or {}).get("experience_years", 0)
        source_attribution["experience_years"] = "resume" if (resume_data or {}).get("experience_years") else "portfolio"

        # 2. Merge Skills without Duplicates
        skills_dict: Dict[str, ExtractedSkill] = {}

        if resume_data and "skills" in resume_data:
            for s in resume_data["skills"]:
                key = s["name"].lower()
                skills_dict[key] = ExtractedSkill(
                    name=s["name"],
                    years=s.get("years", 2),
                    months=s.get("months", 0),
                    source="resume",
                )

        if portfolio_data and "skills" in portfolio_data:
            for s in portfolio_data["skills"]:
                key = s["name"].lower()
                if key not in skills_dict:
                    skills_dict[key] = ExtractedSkill(
                        name=s["name"],
                        years=s.get("years", 1),
                        months=s.get("months", 0),
                        source="portfolio",
                    )

        merged_skills = list(skills_dict.values())

        # 3. Work Experiences (Resume first, fallback to Portfolio)
        experiences: List[ExtractedExperience] = []
        if resume_data and resume_data.get("experiences"):
            for exp in resume_data["experiences"]:
                experiences.append(
                    ExtractedExperience(
                        company_name=exp.get("company_name", "Technology Company"),
                        job_title=exp.get("job_title", "Software Engineer"),
                        start_date=exp.get("start_date"),
                        end_date=exp.get("end_date"),
                        description=exp.get("description"),
                        source="resume",
                    )
                )
        elif portfolio_data and portfolio_data.get("experiences"):
            for exp in portfolio_data["experiences"]:
                experiences.append(
                    ExtractedExperience(
                        company_name=exp.get("company_name", "Technology Company"),
                        job_title=exp.get("job_title", "Software Developer"),
                        start_date=exp.get("start_date"),
                        end_date=exp.get("end_date"),
                        description=exp.get("description"),
                        source="portfolio",
                    )
                )

        # 4. Educations (Resume first, fallback to Portfolio)
        educations: List[ExtractedEducation] = []
        if resume_data and resume_data.get("educations"):
            for edu in resume_data["educations"]:
                educations.append(
                    ExtractedEducation(
                        institution=edu.get("institution", "University"),
                        degree=edu.get("degree"),
                        field_of_study=edu.get("field_of_study"),
                        start_year=edu.get("start_year"),
                        end_year=edu.get("end_year"),
                        source="resume",
                    )
                )
        elif portfolio_data and portfolio_data.get("educations"):
            for edu in portfolio_data["educations"]:
                educations.append(
                    ExtractedEducation(
                        institution=edu.get("institution", "University"),
                        degree=edu.get("degree"),
                        field_of_study=edu.get("field_of_study"),
                        start_year=edu.get("start_year"),
                        end_year=edu.get("end_year"),
                        source="portfolio",
                    )
                )

        profile_data = ExtractedProfileData(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            city=city,
            country=country,
            headline=headline,
            target_role=target_role,
            about=(portfolio_data or {}).get("about"),
            linkedin_url=linkedin_url,
            github_url=github_url,
            website_url=website_url,
            experience_years=experience_years,
            experience_months=0,
        )

        return ProfileExtractionResult(
            sources=sources,
            profile=profile_data,
            skills=merged_skills,
            experiences=experiences,
            educations=educations,
            conflicts=conflicts,
            warnings=warnings,
            source_attribution=source_attribution,
            is_readable=is_readable,
        )
