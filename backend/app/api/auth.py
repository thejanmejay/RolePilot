"""Authentication lifecycle and registration validation endpoints."""

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.services.account_service import AccountService

router = APIRouter(prefix="/auth", tags=["Auth"])


class CheckRegistrationEmailRequest(BaseModel):
    email: str


class CheckRegistrationEmailResponse(BaseModel):
    allowed: bool
    message: str


@router.post(
    "/check-registration",
    response_model=CheckRegistrationEmailResponse,
    status_code=status.HTTP_200_OK,
)
@router.post(
    "/check-email",
    response_model=CheckRegistrationEmailResponse,
    status_code=status.HTTP_200_OK,
)
def check_registration_email(
    payload: CheckRegistrationEmailRequest,
    db: Session = Depends(get_db),
) -> CheckRegistrationEmailResponse:
    """Validate whether an email address is eligible for new account registration.

    Rejects emails reserved by previously deleted accounts with HTTP 409 Conflict.
    """
    AccountService.validate_registration_email(db, payload.email)
    return CheckRegistrationEmailResponse(
        allowed=True,
        message="Email is available for registration.",
    )
