"""Gemini embedding generation for MongoDB Atlas Vector Search."""

from __future__ import annotations

import asyncio

from app.config.settings import get_settings
from app.core.logging import get_logger
from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
    _build_http_options,
    _require_api_key,
    sanitize_error_message,
)

logger = get_logger(__name__)

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
DEFAULT_EMBEDDING_DIMENSIONS = 768
DOCUMENT_TASK_TYPE = "RETRIEVAL_DOCUMENT"
QUERY_TASK_TYPE = "RETRIEVAL_QUERY"


class GeminiEmbeddingClient:
    """Thin wrapper around google-genai embed_content for testability."""

    def embed(
        self,
        *,
        api_key: str,
        model_name: str,
        texts: list[str],
        task_type: str,
        dimensions: int,
    ) -> list[list[float]]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key, http_options=_build_http_options())
        response = client.models.embed_content(
            model=model_name,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=dimensions,
            ),
        )
        embeddings = getattr(response, "embeddings", None) or []
        vectors: list[list[float]] = []
        for item in embeddings:
            values = getattr(item, "values", None)
            if not values:
                raise GeminiProviderError("Gemini returned an empty embedding.")
            vectors.append([float(value) for value in values])
        if len(vectors) != len(texts):
            raise GeminiProviderError("Gemini embedding count did not match input.")
        return vectors


_embedding_client = GeminiEmbeddingClient()


def get_embedding_client() -> GeminiEmbeddingClient:
    return _embedding_client


def set_embedding_client(client: GeminiEmbeddingClient) -> None:
    """Replace the embedding client (tests only)."""
    global _embedding_client
    _embedding_client = client


def _resolve_embedding_model() -> str:
    settings = get_settings()
    model = getattr(settings, "gemini_embedding_model", None)
    if isinstance(model, str) and model.strip():
        return model.strip()
    return DEFAULT_EMBEDDING_MODEL


def _resolve_embedding_dimensions() -> int:
    settings = get_settings()
    try:
        dimensions = int(getattr(settings, "gemini_embedding_dimensions", 0) or 0)
    except (TypeError, ValueError):
        dimensions = DEFAULT_EMBEDDING_DIMENSIONS
    return dimensions if dimensions > 0 else DEFAULT_EMBEDDING_DIMENSIONS


def _embed_texts_sync(texts: list[str], *, task_type: str) -> list[list[float]]:
    cleaned = [str(text or "").strip() for text in texts]
    if not cleaned or any(not text for text in cleaned):
        raise GeminiProviderError("Embedding input must not be empty.")

    api_key = _require_api_key()
    model_name = _resolve_embedding_model()
    dimensions = _resolve_embedding_dimensions()

    try:
        return get_embedding_client().embed(
            api_key=api_key,
            model_name=model_name,
            texts=cleaned,
            task_type=task_type,
            dimensions=dimensions,
        )
    except GeminiProviderError:
        raise
    except GeminiConfigurationError:
        raise
    except Exception as exc:
        logger.error("Gemini embedding failed")
        raise GeminiProviderError(
            sanitize_error_message(str(exc)),
        ) from exc


async def embed_texts(
    texts: list[str],
    *,
    task_type: str = DOCUMENT_TASK_TYPE,
) -> list[list[float]]:
    """Embed texts with Gemini. Never logs the API key or vectors."""
    return await asyncio.to_thread(
        _embed_texts_sync,
        texts,
        task_type=task_type,
    )


async def embed_query(query: str) -> list[float]:
    vectors = await embed_texts([query], task_type=QUERY_TASK_TYPE)
    return vectors[0]
