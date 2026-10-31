"""SQLAlchemy database models."""

from backend.app.db.models.application import Application
from backend.app.db.models.application_answer import ApplicationAnswer
from backend.app.db.models.automation_log import AutomationLog
from backend.app.db.models.automation_run import AutomationRun
from backend.app.db.models.education import Education
from backend.app.db.models.experience import Experience
from backend.app.db.models.job import Job
from backend.app.db.models.linkedin_account import LinkedInAccount
from backend.app.db.models.profile import Profile
from backend.app.db.models.resume import Resume
from backend.app.db.models.search_config import SearchConfig
from backend.app.db.models.skill import Skill
from backend.app.db.models.policy_acceptance import UserPolicyAcceptance
from backend.app.db.models.email_reservation import EmailReservation
from backend.app.db.models.notification import Notification
from backend.app.db.models.synced_job import SyncedJob

__all__ = [
    "Profile",
    "Experience",
    "Education",
    "Skill",
    "Resume",
    "LinkedInAccount",
    "SearchConfig",
    "Job",
    "AutomationRun",
    "AutomationLog",
    "Application",
    "ApplicationAnswer",
    "UserPolicyAcceptance",
    "EmailReservation",
    "Notification",
    "SyncedJob",
]


