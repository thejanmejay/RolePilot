"""Job service for accessing global job records and upserting collected jobs."""

import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models.job import Job


class JobService:
    @staticmethod
    def get_jobs(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        company: Optional[str] = None,
        location: Optional[str] = None,
    ) -> List[Job]:
        stmt = select(Job)
        if search:
            stmt = stmt.where(
                (Job.title.ilike(f"%{search}%"))
                | (Job.description.ilike(f"%{search}%"))
            )
        if company:
            stmt = stmt.where(Job.company.ilike(f"%{company}%"))
        if location:
            stmt = stmt.where(Job.location.ilike(f"%{location}%"))

        stmt = stmt.order_by(Job.created_at.desc()).offset(skip).limit(limit)
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_job_by_id(db: Session, job_id: uuid.UUID) -> Optional[Job]:
        stmt = select(Job).where(Job.id == job_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_job_by_linkedin_id(
        db: Session, linkedin_job_id: str
    ) -> Optional[Job]:
        stmt = select(Job).where(Job.linkedin_job_id == linkedin_job_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def upsert_job(
        db: Session,
        linkedin_job_id: str,
        title: str,
        company: str,
        job_url: str,
        location: Optional[str] = None,
        description: Optional[str] = None,
        employment_type: Optional[str] = None,
        experience_level: Optional[str] = None,
        salary_min: Optional[float] = None,
        salary_max: Optional[float] = None,
        posted_at: Optional[datetime] = None,
        raw_data: Optional[dict] = None,
        **kwargs,
    ) -> Job:
        existing = JobService.get_job_by_linkedin_id(db, linkedin_job_id)
        if existing:
            existing.title = title
            existing.company = company
            existing.job_url = job_url
            if location:
                existing.location = location
            if description:
                existing.description = description
            if employment_type:
                existing.employment_type = employment_type
            if experience_level:
                existing.experience_level = experience_level
            if salary_min is not None:
                existing.salary_min = salary_min
            if salary_max is not None:
                existing.salary_max = salary_max
            if posted_at:
                existing.posted_at = posted_at
            if raw_data:
                existing.raw_data = raw_data
            db.commit()
            db.refresh(existing)
            return existing

        job = Job(
            linkedin_job_id=linkedin_job_id,
            title=title,
            company=company,
            location=location,
            job_url=job_url,
            description=description,
            employment_type=employment_type,
            experience_level=experience_level,
            salary_min=salary_min,
            salary_max=salary_max,
            posted_at=posted_at,
            raw_data=raw_data,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job
