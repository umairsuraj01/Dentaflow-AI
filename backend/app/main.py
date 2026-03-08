# main.py — FastAPI application factory and startup configuration.

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.config import get_settings
from app.constants import APP_NAME, APP_TAGLINE, APP_VERSION
from app.database.base import Base
from app.database.connection import async_engine
from app.exceptions import AppException
from app.models import (  # noqa: F811 — registers models with Base
    User, AuditLog, Patient, Case, CaseFile, CaseNote, ToothInstruction,
    SegmentationResult, Correction,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle startup and shutdown events."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(
        title=APP_NAME,
        description=APP_TAGLINE,
        version=APP_VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    _add_middleware(app)
    _add_exception_handlers(app)
    _add_routes(app)
    return app


def _add_middleware(app: FastAPI) -> None:
    """Register all middleware."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _add_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        """Handle custom application exceptions."""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "message": exc.message,
                "detail": exc.detail,
            },
        )


def _add_routes(app: FastAPI) -> None:
    """Mount all API routers."""
    app.include_router(api_router)

    @app.get("/health")
    async def health_check() -> dict[str, str]:
        """Return service health status."""
        return {"status": "healthy", "app": APP_NAME}


app = create_app()
