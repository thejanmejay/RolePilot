"""Configuration models and YAML loader."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field


DEFAULT_BLACKLIST_TITLES: list[str] = [
    "Manager",
    "Director",
    "Architect",
    "Principal",
    "Staff",
    "Senior Staff",
    "Senior",
    "Lead",
    "VP",
]

class ProfileConfig(BaseModel):
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    city: str = ""
    state: str = ""
    country: str = "India"
    linkedin_url: str = ""
    github_url: str = "https://github.com/thejanmejay"
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
    blacklist_title: list[str] = Field(default_factory=lambda: list(DEFAULT_BLACKLIST_TITLES))
    blacklist_companies: list[str] = Field(default_factory=list)
    follow_company: bool = False
    allow_live_submission: bool = False


class CustomAnswer(BaseModel):
    pattern: str
    answer: str


DEFAULT_CUSTOM_ANSWERS: list[CustomAnswer] = [
    CustomAnswer(pattern=r"(?i)experience with api testing.*which tools", answer="Postman"),
    CustomAnswer(pattern=r"(?i)which tools.*(api|api testing)", answer="Postman"),
    CustomAnswer(pattern=r"(?i)worked on.*both manual and automation", answer="Yes"),
    CustomAnswer(pattern=r"(?i)experience (using|with) jira", answer="Yes"),
    CustomAnswer(pattern=r"years?.*(java|selenium|postman|testng|api testing|integration testing)", answer="2"),
    CustomAnswer(
        pattern=r"(?i)^(?!.*(which tools|how many|years|rate|describe|what tools|list)).*(do you have|hands-on|have you)?.*experience.*(quality assurance|qa|testing tools|api testing|rest api|postman|selenium|automation)",
        answer="Yes",
    ),
    CustomAnswer(pattern=r"(?i)associated with.*(product-based company|product company)", answer="Yes"),
    CustomAnswer(pattern=r"authorized.*work.*india|legally.*authorized.*india|eligible.*work.*india", answer="Yes"),
    CustomAnswer(pattern=r"currently.*based.*india|based.*in.*india", answer="Yes"),
    CustomAnswer(pattern=r"(?i)currently (based out of|located in|living in|residing in).*?(delhi|ncr|delhi/ncr|noida|gurgaon|gurugram)", answer="Yes"),
    CustomAnswer(pattern=r"remote.*from.*india|work.*remotely.*from.*india|available.*remote.*india", answer="Yes"),
    CustomAnswer(pattern=r"require.*sponsorship|need.*sponsorship|sponsorship.*required", answer="No"),
    CustomAnswer(pattern=r"willing.*relocate|open.*relocation|willing.*to.*move", answer="Yes"),
    CustomAnswer(pattern=r"(?i)(current|present).*(salary|ctc|compensation).*(\(in lakhs|in lakh|lpa|lacs?)", answer="3.78"),
    CustomAnswer(pattern=r"(?i)(expected|desired|target).*(salary|ctc|compensation).*(\(in lakhs|in lakh|lpa|lacs?)", answer="5.5"),
    CustomAnswer(pattern=r"(?i)^(?!.*(in-hand|take-home|lakh|lpa|month|\blacs?\b)).*(current|present).*(ctc|salary|compensation)", answer="378000"),
    CustomAnswer(pattern=r"(?i)^(?!.*(in-hand|take-home|lakh|lpa|month|\blacs?\b)).*(expected|desired|target).*(ctc|salary|compensation)", answer="550000"),
    CustomAnswer(pattern=r"(?i)(have you|did you|do you)?.*(completed|finish|hold|have).*(bachelor|b\.?tech|undergraduate|degree)", answer="Yes"),
    CustomAnswer(pattern=r"gpa|cgpa", answer="7.21"),
]


class AnswersConfig(BaseModel):
    sponsorship_required: bool = False
    authorized_to_work: bool = True
    willing_to_relocate: bool = True
    current_salary: str = "378000"
    desired_salary: str = "550000"
    how_did_you_hear: str = "LinkedIn"
    cover_letter: str = ""
    custom: list[CustomAnswer] = Field(default_factory=lambda: list(DEFAULT_CUSTOM_ANSWERS))


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
