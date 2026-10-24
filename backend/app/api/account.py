"""Authenticated account lifecycle endpoints."""

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.services.account_service import AccountService

router = APIRouter(prefix="/account", tags=["Account"])


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Response:
    """Delete the caller's RolePilot data and Supabase Auth identity."""
    AccountService.delete_account(db, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
