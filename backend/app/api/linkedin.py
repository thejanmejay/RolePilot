"""API endpoints for LinkedIn connection, session persistence, and permission consent."""

from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.api.policy import require_policy_accepted
from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.linkedin import (
    LinkedInActionResponse,
    LinkedInConnectRequest,
    LinkedInConsentRequest,
    LinkedInConsentResponse,
    LinkedInStatusResponse,
)
from backend.app.services.linkedin_session_service import LinkedInSessionService

router = APIRouter(
    prefix="/linkedin",
    tags=["LinkedIn"],
    dependencies=[Depends(require_policy_accepted)],
)


@router.get("/status", response_model=LinkedInStatusResponse)
def get_linkedin_status(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Retrieve the current user's LinkedIn connection state and active consent."""
    status_data = LinkedInSessionService.get_status(db, user_id)
    return status_data


@router.post("/connect", response_model=LinkedInStatusResponse, status_code=status.HTTP_200_OK)
def connect_linkedin_session(
    payload: LinkedInConnectRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Securely encrypt and store LinkedIn session credentials for automation."""
    LinkedInSessionService.save_session(
        db=db,
        user_id=user_id,
        session_token=payload.session_token,
        profile_url=payload.linkedin_profile_url,
    )
    status_data = LinkedInSessionService.get_status(db, user_id)
    return status_data


@router.post("/consent", response_model=LinkedInConsentResponse, status_code=status.HTTP_200_OK)
def record_linkedin_consent(
    payload: LinkedInConsentRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Record candidate's explicit consent for LinkedIn access and automation purpose."""
    if not payload.accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the purpose and permission notice to grant access.",
        )

    consent = LinkedInSessionService.record_consent(
        db=db,
        user_id=user_id,
        policy_version=payload.policy_version,
    )
    return {
        "success": True,
        "policy_version": consent.policy_version,
        "accepted_at": consent.accepted_at,
    }


@router.post("/disconnect", response_model=LinkedInActionResponse)
def disconnect_linkedin(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Wipe stored session credentials and set account state to disconnected."""
    LinkedInSessionService.disconnect(db, user_id)
    return {
        "success": True,
        "status": "disconnected",
        "message": "LinkedIn session disconnected and credentials wiped.",
    }


@router.post("/revoke-consent", response_model=LinkedInActionResponse)
def revoke_linkedin_consent(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Revoke candidate automation consent and disconnect the session."""
    LinkedInSessionService.revoke_consent(db, user_id)
    LinkedInSessionService.disconnect(db, user_id)
    return {
        "success": True,
        "status": "disconnected",
        "message": "LinkedIn automation consent revoked and session disconnected.",
    }
