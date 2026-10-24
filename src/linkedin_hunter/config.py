"""Configuration models and YAML loader."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field


class ProfileConfig(BaseModel):
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    city: str = ""
    state: str = ""
    country: str = "United States"
    linkedin_url: str = ""
    github_url: str = ""
    website: str = ""
    years_of_experience: int = 1
    months_of_experience: int = 10
    notice_period_days: int = 30
    resume_path: str = "resumes/resume.pdf"


class SearchConfig(BaseModel):
    keywords: str = "Software Engineer"
    location: str = "United States"
    distance: int = 50
    geo_id: str = ""  # LinkedIn geoId for precise location targeting
    job_type: str = "full-time"
    experience_level: str = "mid-senior"
    remote: str = ""
    date_posted: str = "past-hour"  # past-hour, past-6h, past-24h, past-week, past-month, any
    easy_apply_only: bool = True
    salary_min: int = 0
    salary_max: int = 0
    sort_by: str = "recent"
    max_jobs: int = 50


class ApplyConfig(BaseModel):
    limit: int = 25
    daily_limit: int = 100
    delay_min: float = 3
    delay_max: float = 8
    break_after: int = 10
    break_duration: int = 120
    blacklist_title: list[str] = Field(default_factory=list)
    blacklist_companies: list[str] = Field(default_factory=list)
    follow_company: bool = False
    allow_live_submission: bool = False


class CustomAnswer(BaseModel):
    pattern: str
    answer: str


class AnswersConfig(BaseModel):
    sponsorship_required: bool = False
    authorized_to_work: bool = True
    willing_to_relocate: bool = True
    current_salary: str = "0"
    desired_salary: str = "0"
    how_did_you_hear: str = "LinkedIn"
    cover_letter: str = ""
    custom: list[CustomAnswer] = Field(default_factory=list)


class BrowserConfig(BaseModel):
    headless: bool = False
    slow_mo: int = 50
    timeout: int = 30000
    user_data_dir: str = ""


class LoggingConfig(BaseModel):
    level: str = "INFO"
    log_file: str = "data/logs/hunter.log"


class HunterConfig(BaseModel):
    profile: ProfileConfig = Field(default_factory=ProfileConfig)
    search: SearchConfig = Field(default_factory=SearchConfig)
    apply: ApplyConfig = Field(default_factory=ApplyConfig)
    answers: AnswersConfig = Field(default_factory=AnswersConfig)
    browser: BrowserConfig = Field(default_factory=BrowserConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)


def get_project_root() -> Path:
    """Walk up from CWD looking for pyproject.toml, else use CWD."""
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        if (parent / "pyproject.toml").exists():
            return parent
    return cwd


def load_config(config_path: Optional[str] = None) -> HunterConfig:
    """Load config from YAML file. Falls back to defaults if no file found."""
    root = get_project_root()
    if config_path:
        path = Path(config_path)
    else:
        path = root / "config.yaml"

    if not path.exists():
        return HunterConfig()

    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    return HunterConfig(**raw)
