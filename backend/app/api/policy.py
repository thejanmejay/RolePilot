"""Policy Acceptance and Consent Tracking API endpoints."""

from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.policy import (
    PolicyAcceptRequest,
    PolicyAcceptResponse,
    PolicyStatusResponse,
)
from backend.app.services.policy_service import PolicyService

router = APIRouter(prefix="/policy", tags=["Policy"])


def require_policy_accepted(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> uuid.UUID:
    """FastAPI dependency requiring active policy acceptance for protected routes.
    
    Returns 403 Forbidden if the user has not accepted the currently active policy version.
    """
    if not PolicyService.has_accepted_active_policy(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform policy acceptance is required before accessing application features.",
            headers={"X-Policy-Required": "true"},
        )
    return user_id


@router.get("/acceptance-status", response_model=PolicyStatusResponse)
def get_policy_acceptance_status(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Retrieve policy acceptance status for the authenticated user."""
    return PolicyService.get_acceptance_status(db, user_id)


@router.post("/accept", response_model=PolicyAcceptResponse)
def accept_policy(
    request: PolicyAcceptRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Record acceptance of the platform policy for the authenticated user."""
    return PolicyService.accept_policy(
        db=db,
        user_id=user_id,
        policy_type=request.policy_type,
        policy_version=request.policy_version,
    )
