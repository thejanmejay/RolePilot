"""Search configuration service for user job search preferences."""

import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models.search_config import SearchConfig
from backend.app.schemas.search import SearchConfigCreate, SearchConfigUpdate


def normalize_keywords(keywords: Optional[object]) -> str:
    if keywords is None:
        return ""
    if isinstance(keywords, list):
        return " ".join(str(k) for k in keywords)
    return str(keywords)


class SearchConfigService:
    @staticmethod
    def get_user_search_configs(
        db: Session, user_id: uuid.UUID
    ) -> List[SearchConfig]:
        stmt = (
            select(SearchConfig)
            .where(SearchConfig.user_id == user_id)
            .order_by(SearchConfig.created_at.desc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_search_config_by_id(
        db: Session, user_id: uuid.UUID, config_id: uuid.UUID
    ) -> Optional[SearchConfig]:
        stmt = select(SearchConfig).where(
            SearchConfig.id == config_id, SearchConfig.user_id == user_id
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def create_search_config(
        db: Session, user_id: uuid.UUID, config_in: SearchConfigCreate
    ) -> SearchConfig:
        config = SearchConfig(
            user_id=user_id,
            name=config_in.name,
            keywords=normalize_keywords(config_in.keywords),
            location=config_in.location or "India",
            job_type=config_in.job_type or "full-time",
            experience_level=config_in.experience_level or "entry,associate",
            remote_type=config_in.remote_type or "",
            date_posted=config_in.date_posted or "past-week",
            easy_apply_only=config_in.easy_apply_only,
            salary_min=config_in.salary_min or 0,
            salary_max=config_in.salary_max or 0,
            max_jobs=config_in.max_jobs,
            is_active=config_in.is_active,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    @staticmethod
    def update_search_config(
        db: Session,
        user_id: uuid.UUID,
        config_id: uuid.UUID,
        config_update: SearchConfigUpdate,
    ) -> Optional[SearchConfig]:
        config = SearchConfigService.get_search_config_by_id(db, user_id, config_id)
        if not config:
            return None

        data = config_update.model_dump(exclude_unset=True)
        for key, value in data.items():
            if key == "keywords" and value is not None:
                value = normalize_keywords(value)
            setattr(config, key, value)

        db.commit()
        db.refresh(config)
        return config

    @staticmethod
    def delete_search_config(
        db: Session, user_id: uuid.UUID, config_id: uuid.UUID
    ) -> bool:
        config = SearchConfigService.get_search_config_by_id(db, user_id, config_id)
        if not config:
            return False

        db.delete(config)
        db.commit()
        return True
