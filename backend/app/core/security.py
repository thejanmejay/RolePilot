"""Authentication and JWT Security for Supabase Auth."""

from __future__ import annotations

import uuid
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.core.config import settings

# HTTP Bearer token extractor
security_scheme = HTTPBearer(auto_error=False)


def decode_supabase_jwt(token: str) -> dict:
    """Decode and validate a Supabase JWT token.
    
    Returns the token payload dictionary with 'sub' containing user UUID.
    """
    try:
        # If secret is provided, verify signature
        if settings.SUPABASE_JWT_SECRET:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": False},
            )
        else:
            # Decode claims without signature verification if secret not configured (development/mock mode)
            payload = jwt.decode(
                token,
                options={"verify_signature": False},
            )
        
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject claim",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify valid UUID format
        uuid.UUID(user_id_str)
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, ValueError, Exception) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> uuid.UUID:
    """FastAPI dependency to get the authenticated user's UUID from Supabase JWT.
    
    Raises 401 UNAUTHORIZED if not authenticated.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_supabase_jwt(credentials.credentials)
    user_id_str = payload.get("sub")
    return uuid.UUID(user_id_str)
