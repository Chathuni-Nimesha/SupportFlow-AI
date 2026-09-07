"""Gemini embedding helper tests (no real API calls)."""

from unittest.mock import MagicMock

import pytest

from app.config.settings import get_settings
from app.services import gemini_embeddings
from app.services.gemini_embeddings import (
    DEFAULT_EMBEDDING_DIMENSIONS,
    DEFAULT_EMBEDDING_MODEL,
    DOCUMENT_TASK_TYPE,
    QUERY_TASK_TYPE,
    GeminiEmbeddingClient,
    embed_query,
    embed_texts,
    set_embedding_client,
)
from app.services.gemini_service import GeminiConfigurationError, GeminiProviderError


@pytest.fixture(autouse=True)
def _reset_embedding_client():
    original = gemini_embeddings.get_embedding_client()
    yield
    set_embedding_client(original)
    get_settings.cache_clear()


@pytest.fixture
def configured_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "test-gemini-key-value")
    monkeypatch.setenv("GEMINI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
    monkeypatch.setenv("GEMINI_EMBEDDING_DIMENSIONS", "768")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_embed_texts_uses_document_task_and_768_dims(configured_settings) -> None:
    mock_client = MagicMock(spec=GeminiEmbeddingClient)
    mock_client.embed.return_value = [[0.1] * 768, [0.2] * 768]
    set_embedding_client(mock_client)

    vectors = await embed_texts(["alpha", "beta"])
    assert vectors == [[0.1] * 768, [0.2] * 768]
    kwargs = mock_client.embed.call_args.kwargs
    assert kwargs["api_key"] == "test-gemini-key-value"
    assert kwargs["model_name"] == DEFAULT_EMBEDDING_MODEL
    assert kwargs["task_type"] == DOCUMENT_TASK_TYPE
    assert kwargs["dimensions"] == DEFAULT_EMBEDDING_DIMENSIONS
    assert kwargs["texts"] == ["alpha", "beta"]


@pytest.mark.asyncio
async def test_embed_query_uses_query_task(configured_settings) -> None:
    mock_client = MagicMock(spec=GeminiEmbeddingClient)
    mock_client.embed.return_value = [[0.3] * 768]
    set_embedding_client(mock_client)

    vector = await embed_query("How do I reset my password?")
    assert vector == [0.3] * 768
    kwargs = mock_client.embed.call_args.kwargs
    assert kwargs["task_type"] == QUERY_TASK_TYPE
    assert kwargs["texts"] == ["How do I reset my password?"]


@pytest.mark.asyncio
async def test_embed_texts_rejects_missing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "")
    get_settings.cache_clear()
    mock_client = MagicMock(spec=GeminiEmbeddingClient)
    set_embedding_client(mock_client)
    with pytest.raises(GeminiConfigurationError):
        await embed_texts(["alpha"])
    mock_client.embed.assert_not_called()


@pytest.mark.asyncio
async def test_embed_texts_does_not_leak_secrets(configured_settings) -> None:
    mock_client = MagicMock(spec=GeminiEmbeddingClient)
    mock_client.embed.side_effect = RuntimeError(
        "auth failed api_key=AIzaSyDummySecretValue123"
    )
    set_embedding_client(mock_client)
    with pytest.raises(GeminiProviderError) as exc_info:
        await embed_texts(["alpha"])
    assert "AIzaSyDummySecretValue123" not in str(exc_info.value)
    assert "test-gemini-key-value" not in str(exc_info.value)
