"""Main FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager
from typing import Dict
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from backend.app.api.router import api_v1_router
from backend.app.core.config import settings
from backend.app.db.database import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("linkedin_hunter_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for application startup and shutdown."""
    logger.info("Starting LinkedIn Hunter SaaS Backend...")
    try:
        from backend.app.db.database import Base, engine
        import backend.app.db.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified / initialized.")
    except Exception as e:
        logger.warning("Could not auto-create tables on startup: %s", e)
    yield
    logger.info("Shutting down LinkedIn Hunter SaaS Backend...")


app = FastAPI(
    title="LinkedIn Hunter SaaS API",
    description="Multi-user SaaS backend for LinkedIn automated job search and applications.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https:\/\/(rolepilot-frontend[a-z0-9-]*|rolepilot[a-z0-9-]*)\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected internal server error occurred."},
    )


# Health Check Endpoints
@app.get("/health", tags=["Health"])
def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/health/db", tags=["Health"])
def health_check_db() -> Dict[str, str]:
    """Database connectivity health check."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        logger.warning("Database health check warning: %s", e)
        return {"status": "degraded", "database": "disconnected"}


# Mount API v1 router
app.include_router(api_v1_router)
