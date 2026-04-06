# main.py — FastAPI application factory and startup configuration.

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.config import get_settings
from app.constants import APP_NAME, APP_TAGLINE, APP_VERSION
from app.database.base import Base
from app.database.connection import async_engine
from app.exceptions import AppException
from app.models import (  # noqa: F811 — registers models with Base
    User, AuditLog, Patient, Case, CaseFile, CaseNote, ToothInstruction,
    SegmentationResult, Correction, TreatmentPlan, TreatmentStep, ToothTransform,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle startup and shutdown events."""
    from app.database.connection import async_session_factory
    from app.services.billing_seed import seed_pricing_plans

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default pricing plans
    async with async_session_factory() as session:
        await seed_pricing_plans(session)
        await session.commit()

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

    # Serve frontend static files in production (Docker build copies to ./static)
    static_dir = Path(__file__).parent.parent / "static"
    if static_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str) -> FileResponse:
            """Serve the SPA index.html for all non-API routes with no-cache headers."""
            file_path = static_dir / full_path
            if file_path.is_file():
                resp = FileResponse(str(file_path))
            else:
                resp = FileResponse(str(static_dir / "index.html"))
            # Prevent browser caching of HTML (JS/CSS have hashed names so they auto-bust)
            if full_path.endswith('.html') or '.' not in full_path.split('/')[-1]:
                resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                resp.headers["Pragma"] = "no-cache"
                resp.headers["Expires"] = "0"
            return resp


app = create_app()
