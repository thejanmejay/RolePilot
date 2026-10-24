"""Profile service for handling user profile, experiences, and skills."""

import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.db.models.education import Education
from backend.app.db.models.experience import Experience
from backend.app.db.models.profile import Profile
from backend.app.db.models.skill import Skill
from backend.app.schemas.profile import (
    EducationCreate,
    ExperienceCreate,
    ProfileUpdate,
    SkillCreate,
)


class ProfileService:
    @staticmethod
    def get_or_create_profile(db: Session, user_id: uuid.UUID) -> Profile:
        stmt = (
            select(Profile)
            .where(Profile.id == user_id)
            .options(
                selectinload(Profile.skills),
                selectinload(Profile.experiences),
                selectinload(Profile.educations),
            )
        )
        profile = db.execute(stmt).scalar_one_or_none()
        if not profile:
            profile = Profile(id=user_id, first_name="Candidate")
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile

    @staticmethod
    def update_profile(
        db: Session, user_id: uuid.UUID, update_data: ProfileUpdate
    ) -> Profile:
        profile = ProfileService.get_or_create_profile(db, user_id)
        data = update_data.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(profile, key, value)
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def add_skill(db: Session, user_id: uuid.UUID, skill_in: SkillCreate) -> Skill:
        years = skill_in.years or 0
        months = skill_in.months or 0

        # Handle float conversions if provided
        if skill_in.years_experience is not None:
            years = int(skill_in.years_experience)
            months = int(round((skill_in.years_experience - years) * 12))
        elif skill_in.years_of_experience is not None:
            years = int(skill_in.years_of_experience)
            months = int(round((skill_in.years_of_experience - years) * 12))

        # Check if skill already exists for this user
        stmt = select(Skill).where(Skill.user_id == user_id, Skill.name == skill_in.name)
        existing = db.execute(stmt).scalar_one_or_none()
        if existing:
            existing.years = years
            existing.months = months
            db.commit()
            db.refresh(existing)
            return existing

        skill = Skill(
            user_id=user_id,
            name=skill_in.name,
            years=years,
            months=months,
        )
        db.add(skill)
        db.commit()
        db.refresh(skill)
        return skill

    @staticmethod
    def add_skills(
        db: Session, user_id: uuid.UUID, skills_in: List[SkillCreate]
    ) -> List[Skill]:
        created = []
        for skill_in in skills_in:
            created.append(ProfileService.add_skill(db, user_id, skill_in))
        return created

    @staticmethod
    def delete_skill(db: Session, user_id: uuid.UUID, skill_id: uuid.UUID) -> bool:
        stmt = select(Skill).where(Skill.id == skill_id, Skill.user_id == user_id)
        skill = db.execute(stmt).scalar_one_or_none()
        if not skill:
            return False
        db.delete(skill)
        db.commit()
        return True

    @staticmethod
    def add_experience(
        db: Session, user_id: uuid.UUID, exp_in: ExperienceCreate
    ) -> Experience:
        company_name = exp_in.company_name or exp_in.company or "Company"
        job_title = exp_in.job_title or exp_in.title or "Role"

        exp = Experience(
            user_id=user_id,
            company_name=company_name,
            job_title=job_title,
            start_date=exp_in.start_date,
            end_date=exp_in.end_date,
            description=exp_in.description,
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    @staticmethod
    def delete_experience(
        db: Session, user_id: uuid.UUID, exp_id: uuid.UUID
    ) -> bool:
        stmt = select(Experience).where(
            Experience.id == exp_id, Experience.user_id == user_id
        )
        exp = db.execute(stmt).scalar_one_or_none()
        if not exp:
            return False
        db.delete(exp)
        db.commit()
        return True

    @staticmethod
    def add_education(
        db: Session, user_id: uuid.UUID, edu_in: EducationCreate
    ) -> Education:
        institution = edu_in.institution or edu_in.school or "Institution"
        field_of_study = edu_in.field_of_study or edu_in.field

        edu = Education(
            user_id=user_id,
            institution=institution,
            degree=edu_in.degree,
            field_of_study=field_of_study,
            start_year=edu_in.start_year,
            end_year=edu_in.end_year,
            description=edu_in.description,
        )
        db.add(edu)
        db.commit()
        db.refresh(edu)
        return edu

    @staticmethod
    def delete_education(
        db: Session, user_id: uuid.UUID, edu_id: uuid.UUID
    ) -> bool:
        stmt = select(Education).where(
            Education.id == edu_id, Education.user_id == user_id
        )
        edu = db.execute(stmt).scalar_one_or_none()
        if not edu:
            return False
        db.delete(edu)
        db.commit()
        return True

