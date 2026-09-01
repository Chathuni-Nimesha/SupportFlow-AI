"""SupportFlow AI — FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config.settings import get_settings
from app.core.logging import get_logger, setup_logging
from app.database.indexes import ensure_indexes
from app.database.mongodb import close_mongodb, connect_mongodb

settings = get_settings()
setup_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown resources."""
    current = get_settings()
    logger.info("Starting %s (%s)", current.app_name, current.app_env)

    try:
        await connect_mongodb()
        await ensure_indexes()
    except Exception as exc:
        logger.warning(
            "MongoDB unavailable (%s). Auth and data features will return "
            "service-unavailable until MongoDB is reachable.",
            exc,
        )

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
        allow_origins=current.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix=current.api_prefix)

    return application


app = create_app()
