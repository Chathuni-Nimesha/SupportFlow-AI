"""ChromaDB client structure (connection only — no business logic)."""

from typing import Any

from app.config.settings import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_chroma_client: Any | None = None


def get_chroma_client() -> Any:
    """
    Lazily create and return a ChromaDB HttpClient.

    Import is deferred so the app can start without ChromaDB running
    until vector-store features are used.
    """
    global _chroma_client

    if _chroma_client is not None:
        return _chroma_client

    import chromadb

    settings = get_settings()
    _chroma_client = chromadb.HttpClient(
        host=settings.chroma_host,
        port=settings.chroma_port,
    )
    logger.info(
        "ChromaDB client configured for %s:%s",
        settings.chroma_host,
        settings.chroma_port,
    )
    return _chroma_client


def reset_chroma_client() -> None:
    """Clear the cached ChromaDB client (useful for tests / shutdown)."""
    global _chroma_client
    _chroma_client = None
