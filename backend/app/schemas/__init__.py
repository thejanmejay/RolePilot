"""Pydantic schemas package."""

from backend.app.schemas.application import (
    ApplicationAnswerBase,
    ApplicationAnswerResponse,
    ApplicationDetailResponse,
    ApplicationResponse,
)
from backend.app.schemas.automation import (
    AutomationLogResponse,
    AutomationRunCreate,
    AutomationRunDetailResponse,
    AutomationRunResponse,
)
from backend.app.schemas.job import JobBase, JobResponse
from backend.app.schemas.profile import (
    ExperienceCreate,
    ExperienceResponse,
    ProfileBase,
    ProfileResponse,
    ProfileUpdate,
    SkillCreate,
    SkillResponse,
)
from backend.app.schemas.resume import ResumeBase, ResumeCreate, ResumeResponse
from backend.app.schemas.search import (
    SearchConfigBase,
    SearchConfigCreate,
    SearchConfigResponse,
    SearchConfigUpdate,
)

__all__ = [
    "ProfileBase",
    "ProfileUpdate",
    "ProfileResponse",
    "SkillCreate",
    "SkillResponse",
    "ExperienceCreate",
    "ExperienceResponse",
    "ResumeBase",
    "ResumeCreate",
    "ResumeResponse",
    "SearchConfigBase",
    "SearchConfigCreate",
    "SearchConfigUpdate",
    "SearchConfigResponse",
    "JobBase",
    "JobResponse",
    "ApplicationResponse",
    "ApplicationDetailResponse",
    "ApplicationAnswerBase",
    "ApplicationAnswerResponse",
    "AutomationRunCreate",
    "AutomationRunResponse",
    "AutomationRunDetailResponse",
    "AutomationLogResponse",
]
