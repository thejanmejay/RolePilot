"""Search Config API endpoints."""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user_id
from backend.app.db.database import get_db
from backend.app.schemas.search import (
    SearchConfigCreate,
    SearchConfigResponse,
    SearchConfigUpdate,
)
from backend.app.services.search_service import SearchConfigService

router = APIRouter(prefix="/search-configs", tags=["Search Configs"])


@router.get("", response_model=List[SearchConfigResponse])
def list_search_configs(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all search configurations belonging to the authenticated user."""
    return SearchConfigService.get_user_search_configs(db, user_id)


@router.post("", response_model=SearchConfigResponse, status_code=status.HTTP_201_CREATED)
def create_search_config(
    config_in: SearchConfigCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new search configuration for the authenticated user."""
    return SearchConfigService.create_search_config(db, user_id, config_in)


@router.get("/{id}", response_model=SearchConfigResponse)
def get_search_config(
    id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get a search configuration by ID."""
    config = SearchConfigService.get_search_config_by_id(db, user_id, id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Search configuration not found",
        )
    return config


@router.patch("/{id}", response_model=SearchConfigResponse)
def update_search_config(
    id: uuid.UUID,
    config_update: SearchConfigUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update a search configuration belonging to the authenticated user."""
    config = SearchConfigService.update_search_config(db, user_id, id, config_update)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Search configuration not found",
        )
    return config


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_search_config(
    id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a search configuration belonging to the authenticated user."""
    success = SearchConfigService.delete_search_config(db, user_id, id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Search configuration not found",
        )
