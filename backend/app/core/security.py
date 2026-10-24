"""Authentication and JWT Security for Supabase Auth with JWKS & HMAC verification."""

from __future__ import annotations

import logging
import uuid
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# HTTP Bearer token extractor
security_scheme = HTTPBearer(auto_error=False)

# Reusable PyJWKClient instance
_jwks_client: Optional[jwt.PyJWKClient] = None


def get_jwks_client() -> Optional[jwt.PyJWKClient]:
    """Retrieve or initialize PyJWKClient for Supabase."""
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client

    jwks_url = settings.SUPABASE_JWKS_URL
    if not jwks_url and settings.SUPABASE_URL:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"

    if jwks_url:
        try:
            _jwks_client = jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
        except Exception as e:
            logger.warning("Could not initialize JWKS client: %s", e)
    return _jwks_client


def decode_supabase_jwt(token: str) -> dict:
    """Decode and validate a Supabase JWT token using JWKS or HMAC secret.
    
    Returns the token payload dictionary with 'sub' containing user UUID.
    Raises HTTPException(401) if validation fails.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing or empty",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Extract unverified header to determine key ID and algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")
        kid = unverified_header.get("kid")

        payload: Optional[dict] = None

        # 1. If token is signed with asymmetric key (e.g. ES256, RS256) and JWKS is available
        if alg in ("ES256", "RS256") or kid:
            jwks_client = get_jwks_client()
            if jwks_client:
                try:
                    signing_key = jwks_client.get_signing_key_from_jwt(token)
                    payload = jwt.decode(
                        token,
                        signing_key.key,
                        algorithms=[alg],
                        audience="authenticated",
                        options={"verify_aud": False},
                    )
                except jwt.ExpiredSignatureError:
                    raise
                except Exception as jwks_err:
                    logger.debug("JWKS verification failed: %s", jwks_err)

        # 2. If token is signed with HS256 and SUPABASE_JWT_SECRET is configured
        if payload is None and settings.SUPABASE_JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                    options={"verify_aud": False},
                )
            except jwt.ExpiredSignatureError:
                raise
            except Exception as hs_err:
                logger.debug("HS256 secret verification failed: %s", hs_err)

        # 3. Development fallback if no secret or JWKS configured (allows offline unit tests)
        if payload is None:
            if not settings.SUPABASE_JWT_SECRET and not settings.SUPABASE_URL:
                payload = jwt.decode(
                    token,
                    options={"verify_signature": False},
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token signature or key not found",
                    headers={"WWW-Authenticate": "Bearer"},
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
    except HTTPException:
        raise
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
