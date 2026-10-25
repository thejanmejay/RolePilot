"""Application Configuration and Environment Settings."""

from __future__ import annotations

import json
import os
from typing import Optional
from pydantic import Field, field_validator
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
    SUPABASE_JWKS_URL: str = Field(default="", validation_alias="SUPABASE_JWKS_URL")
    FRONTEND_ORIGIN: str = Field(default="http://localhost:3000", validation_alias="FRONTEND_ORIGIN")
    
    # Platform Policy and Terms Consent Configuration
    ACTIVE_POLICY_VERSION: str = Field(default="draft-1", validation_alias="ACTIVE_POLICY_VERSION")
    ACTIVE_POLICY_TYPE: str = Field(default="platform_terms", validation_alias="ACTIVE_POLICY_TYPE")
    ENFORCE_POLICY_ACCEPTANCE: bool = Field(default=True, validation_alias="ENFORCE_POLICY_ACCEPTANCE")
    
    # Database Configuration (PostgreSQL / Supabase)
    DATABASE_URL: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
        validation_alias="DATABASE_URL",
    )

    # File upload limits
    MAX_RESUME_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    RESUME_STORAGE_BUCKET: str = "resumes"

    # CORS settings - production Vercel and local development origins
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "https://rolepilot-frontend-phi.vercel.app",
            "https://rolepilot-frontend.vercel.app",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:5173",
        ]
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: object) -> list[str]:
        default_origins: list[str] = [
            "https://rolepilot-frontend-phi.vercel.app",
            "https://rolepilot-frontend.vercel.app",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:5173",
        ]

        parsed: list[str] = []
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                try:
                    parsed = json.loads(v_str)
                except Exception:
                    parsed = [item.strip().strip("'\"") for item in v_str[1:-1].split(",") if item.strip()]
            else:
                parsed = [item.strip() for item in v_str.split(",") if item.strip()]
        elif isinstance(v, (list, tuple, set)):
            parsed = [str(item).strip() for item in v if item]

        all_origins = list(default_origins)
        for item in parsed:
            cleaned = item.rstrip("/")
            if cleaned and cleaned != "*" and cleaned not in all_origins:
                all_origins.append(cleaned)

        frontend_env = os.getenv("FRONTEND_ORIGIN", "").strip().rstrip("/")
        if frontend_env and frontend_env != "*" and frontend_env not in all_origins:
            all_origins.append(frontend_env)

        return all_origins

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
