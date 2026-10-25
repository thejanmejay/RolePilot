"""API v1 router combining all resource endpoints."""

from fastapi import APIRouter

from backend.app.api.account import router as account_router
from backend.app.api.applications import router as applications_router
from backend.app.api.automation import router as automation_router
from backend.app.api.jobs import router as jobs_router
from backend.app.api.linkedin import router as linkedin_router
from backend.app.api.policy import router as policy_router
from backend.app.api.profile import router as profile_router
from backend.app.api.resumes import router as resumes_router
from backend.app.api.search import router as search_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(account_router)
api_v1_router.include_router(policy_router)
api_v1_router.include_router(linkedin_router)
api_v1_router.include_router(profile_router)
api_v1_router.include_router(resumes_router)
api_v1_router.include_router(search_router)
api_v1_router.include_router(jobs_router)
api_v1_router.include_router(applications_router)
api_v1_router.include_router(automation_router)
