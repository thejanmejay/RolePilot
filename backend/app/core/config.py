"""Application Configuration and Environment Settings."""

from __future__ import annotations

import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "LinkedIn Hunter SaaS"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development", validation_alias="ENVIRONMENT")
    
    # Supabase Configuration
    SUPABASE_URL: str = Field(default="", validation_alias="SUPABASE_URL")
    SUPABASE_ANON_KEY: str = Field(default="", validation_alias="SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_JWT_SECRET: str = Field(default="", validation_alias="SUPABASE_JWT_SECRET")
    
    # Database Configuration (PostgreSQL / Supabase)
    DATABASE_URL: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
        validation_alias="DATABASE_URL",
    )

    # File upload limits
    MAX_RESUME_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    RESUME_STORAGE_BUCKET: str = "resumes"

    # CORS settings
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["*"])

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        """Ensure standard Postgres URLs work seamlessly with SQLAlchemy psycopg driver."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url


settings = Settings()
