"""SupportFlow AI — FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config.settings import get_settings
from app.core.cors import (
    CORS_ALLOW_HEADERS,
    CORS_ALLOW_METHODS,
    resolve_cors_origins,
)
from app.core.logging import get_logger, setup_logging
from app.database.indexes import ensure_indexes
from app.database.mongodb import close_mongodb, connect_mongodb, ping_mongodb

settings = get_settings()
setup_logging(settings.log_level)
logger = get_logger(__name__)

PRODUCTION_MONGODB_STARTUP_ERROR = (
    "MongoDB initialization failed. Check MONGODB_URI and network access."
)


async def initialize_mongodb(*, fail_closed: bool) -> None:
    """Connect and ensure indexes. Production fails closed; development degrades."""
    try:
        await connect_mongodb()
        await ensure_indexes()
    except Exception as exc:
        logger.warning(
            "MongoDB unavailable (%s). Auth and data features will return "
            "service-unavailable until MongoDB is reachable.",
            type(exc).__name__,
        )
        if fail_closed:
            logger.error("MongoDB initialization failed in production; refusing to start.")
            raise RuntimeError(PRODUCTION_MONGODB_STARTUP_ERROR) from None


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown resources."""
    current = get_settings()
    logger.info("Starting %s (%s)", current.app_name, current.app_env)

    await initialize_mongodb(fail_closed=current.is_production)

    try:
        yield
    finally:
        await close_mongodb()
        logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    current = get_settings()
    docs_enabled = current.app_debug
    application = FastAPI(
        title=current.app_name,
        version=current.app_version,
        debug=current.app_debug,
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolve_cors_origins(current),
        allow_credentials=True,
        allow_methods=list(CORS_ALLOW_METHODS),
        allow_headers=list(CORS_ALLOW_HEADERS),
    )

    @application.get("/health", tags=["health"])
    async def health() -> JSONResponse:
        """Liveness/readiness: process is up; database ping is reported."""
        connected = await ping_mongodb()
        payload = {
            "status": "ok" if connected else "degraded",
            "database": "connected" if connected else "disconnected",
        }
        return JSONResponse(
            payload,
            status_code=200 if connected else 503,
        )

    application.include_router(api_router, prefix=current.api_prefix)

    return application


app = create_app()
