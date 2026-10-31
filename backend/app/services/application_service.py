"""Application service for managing user applications and question answers."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.db.models.application import Application
from backend.app.db.models.application_answer import ApplicationAnswer


class ApplicationService:
    @staticmethod
    def get_user_applications(
        db: Session,
        user_id: uuid.UUID,
        status: Optional[str] = None,
        run_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Application]:
        stmt = (
            select(Application)
            .where(Application.user_id == user_id)
            .options(selectinload(Application.job))
        )
        if status:
            stmt = stmt.where(Application.status == status)
        if run_id:
            stmt = stmt.where(Application.run_id == run_id)

        stmt = stmt.order_by(Application.created_at.desc()).offset(skip).limit(limit)
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_application_by_id(
        db: Session, user_id: uuid.UUID, application_id: uuid.UUID
    ) -> Optional[Application]:
        stmt = (
            select(Application)
            .where(
                Application.id == application_id,
                Application.user_id == user_id,
            )
            .options(
                selectinload(Application.job),
                selectinload(Application.answers),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_application_answers(
        db: Session, user_id: uuid.UUID, application_id: uuid.UUID
    ) -> List[ApplicationAnswer]:
        app = ApplicationService.get_application_by_id(db, user_id, application_id)
        if not app:
            return []
        stmt = (
            select(ApplicationAnswer)
            .where(ApplicationAnswer.application_id == application_id)
            .order_by(ApplicationAnswer.created_at.asc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def record_application(
        db: Session,
        user_id: uuid.UUID,
        job_id: uuid.UUID,
        status: str,
        run_id: Optional[uuid.UUID] = None,
        error_message: Optional[str] = None,
        application_url: Optional[str] = None,
        **kwargs,
    ) -> Application:
        stmt = select(Application).where(
            Application.user_id == user_id,
            Application.job_id == job_id,
        )
        existing = db.execute(stmt).scalar_one_or_none()
        submitted_at = datetime.utcnow() if status in ["applied", "submitted"] else None

        if existing:
            # Preservation Rule: Never overwrite an existing 'applied' or 'submitted' status with a dry run or transient failure
            if existing.status in ["applied", "submitted"] and status not in ["applied", "submitted"]:
                return existing

            existing.status = status
            existing.run_id = run_id or existing.run_id
            existing.error_message = error_message or existing.error_message
            if submitted_at:
                existing.submitted_at = submitted_at
            if application_url:
                existing.application_url = application_url
            db.commit()
            db.refresh(existing)
            return existing

        app = Application(
            user_id=user_id,
            job_id=job_id,
            run_id=run_id,
            status=status,
            error_message=error_message,
            submitted_at=submitted_at,
            application_url=application_url,
        )
        db.add(app)
        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def record_answer(
        db: Session,
        application_id: uuid.UUID,
        question: str,
        answer: str,
        question_type: Optional[str] = None,
        answer_source: Optional[str] = None,
        confidence: Optional[float] = None,
        **kwargs,
    ) -> ApplicationAnswer:
        # Map question_text/answer_value if passed as legacy aliases
        q = question or kwargs.get("question_text", "")
        a = answer or kwargs.get("answer_value", "")
        ans = ApplicationAnswer(
            application_id=application_id,
            question=q,
            answer=str(a),
            question_type=question_type,
            answer_source=answer_source,
            confidence=confidence,
        )
        db.add(ans)
        db.commit()
        db.refresh(ans)
        return ans

    @staticmethod
    def update_application(
        db: Session,
        user_id: uuid.UUID,
        application_id: uuid.UUID,
        status: Optional[str] = None,
        application_url: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Optional[Application]:
        app = ApplicationService.get_application_by_id(db, user_id, application_id)
        if not app:
            return None
        if status is not None:
            app.status = status
            if status in ["applied", "submitted"] and not app.submitted_at:
                app.submitted_at = datetime.utcnow()
        if application_url is not None:
            app.application_url = application_url
        if error_message is not None:
            app.error_message = error_message
        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def delete_application(
        db: Session, user_id: uuid.UUID, application_id: uuid.UUID
    ) -> bool:
        app = ApplicationService.get_application_by_id(db, user_id, application_id)
        if not app:
            return False
        db.delete(app)
        db.commit()
        return True

