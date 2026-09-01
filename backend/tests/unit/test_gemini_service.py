"""Gemini grounded-answer service tests (no real API calls)."""

import logging
from unittest.mock import MagicMock

import pytest

from app.config.settings import get_settings
from app.services import gemini_service
from app.services.gemini_service import (
    GeminiClient,
    GeminiConfigurationError,
    GeminiProviderError,
    GeminiValidationError,
    _build_http_options,
    build_user_prompt,
    generate_grounded_answer,
    sanitize_error_message,
    set_gemini_client,
)


@pytest.fixture(autouse=True)
def _reset_gemini_client():
    original = gemini_service.get_gemini_client()
    yield
    set_gemini_client(original)
    get_settings.cache_clear()


@pytest.fixture
def configured_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "test-gemini-key-value")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


def test_build_user_prompt_separates_question_and_context() -> None:
    prompt = build_user_prompt(
        question="What is the refund policy?",
        context="Refunds are available within 14 days.",
    )
    assert "Knowledge context:" in prompt
    assert "Refunds are available within 14 days." in prompt
    assert "Customer question:" in prompt
    assert "What is the refund policy?" in prompt


def test_sanitize_error_message_redacts_api_key_material() -> None:
    message = "Auth failed for api_key=AIzaSyDummySecretValue123"
    sanitized = sanitize_error_message(message)
    assert "AIzaSyDummySecretValue123" not in sanitized
    assert "api_key=AIzaSyDummySecretValue123" not in sanitized
    assert "[redacted]" in sanitized


@pytest.mark.asyncio
async def test_generate_grounded_answer_success(
    configured_settings,
) -> None:
    mock_client = MagicMock(spec=GeminiClient)
    mock_client.generate.return_value = (
        "You can request a refund within 14 days of purchase."
    )
    set_gemini_client(mock_client)

    answer = await generate_grounded_answer(
        question="What is the refund policy?",
        context="Refunds are available within 14 days.",
    )

    assert answer == "You can request a refund within 14 days of purchase."
    mock_client.generate.assert_called_once()
    kwargs = mock_client.generate.call_args.kwargs
    assert kwargs["api_key"] == "test-gemini-key-value"
    assert kwargs["model_name"] == "gemini-3.5-flash-lite"
    assert "customer support assistant" in kwargs["system_instruction"].lower()
    assert "Refunds are available within 14 days." in kwargs["user_prompt"]
    assert "What is the refund policy?" in kwargs["user_prompt"]
    assert "RAG" not in kwargs["system_instruction"]
    assert "ChromaDB" not in kwargs["system_instruction"]


@pytest.mark.asyncio
async def test_generate_grounded_answer_passes_question_and_context(
    configured_settings,
) -> None:
    mock_client = MagicMock(spec=GeminiClient)
    mock_client.generate.return_value = "Answer"
    set_gemini_client(mock_client)

    await generate_grounded_answer(
        question="How do I reset my password?",
        context="Use the account security page to reset passwords.",
    )

    user_prompt = mock_client.generate.call_args.kwargs["user_prompt"]
    assert "How do I reset my password?" in user_prompt
    assert "Use the account security page to reset passwords." in user_prompt


@pytest.mark.asyncio
async def test_generate_grounded_answer_missing_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "")
    get_settings.cache_clear()
    mock_client = MagicMock(spec=GeminiClient)
    set_gemini_client(mock_client)

    with pytest.raises(GeminiConfigurationError) as exc_info:
        await generate_grounded_answer(
            question="What is the refund policy?",
            context="Refunds are available within 14 days.",
        )

    assert "GOOGLE_API_KEY" in str(exc_info.value)
    assert "test-gemini-key-value" not in str(exc_info.value)
    mock_client.generate.assert_not_called()


@pytest.mark.asyncio
async def test_generate_grounded_answer_rejects_placeholder_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "your_google_gemini_api_key_here")
    get_settings.cache_clear()

    with pytest.raises(GeminiConfigurationError):
        await generate_grounded_answer(
            question="What is the refund policy?",
            context="Refunds are available within 14 days.",
        )


@pytest.mark.asyncio
async def test_generate_grounded_answer_empty_question(
    configured_settings,
) -> None:
    mock_client = MagicMock(spec=GeminiClient)
    set_gemini_client(mock_client)

    with pytest.raises(GeminiValidationError, match="Question"):
        await generate_grounded_answer(
            question="   ",
            context="Some context",
        )
    mock_client.generate.assert_not_called()


@pytest.mark.asyncio
async def test_generate_grounded_answer_empty_context(
    configured_settings,
) -> None:
    mock_client = MagicMock(spec=GeminiClient)
    set_gemini_client(mock_client)

    with pytest.raises(GeminiValidationError, match="context"):
        await generate_grounded_answer(
            question="What is the refund policy?",
            context="  ",
        )
    mock_client.generate.assert_not_called()


@pytest.mark.asyncio
async def test_generate_grounded_answer_provider_error(
    configured_settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    fake_key = "AIzaSyShouldNeverLeak"
    raw_provider_text = (
        f"upstream failed api_key={fake_key}. Authorization: Bearer {fake_key}"
    )
    mock_client = MagicMock(spec=GeminiClient)
    mock_client.generate.side_effect = RuntimeError(raw_provider_text)
    set_gemini_client(mock_client)

    with caplog.at_level(logging.ERROR, logger="app.services.gemini_service"):
        with pytest.raises(GeminiProviderError) as exc_info:
            await generate_grounded_answer(
                question="What is the refund policy?",
                context="Refunds are available within 14 days.",
            )

    message = str(exc_info.value)
    assert fake_key not in message
    assert f"api_key={fake_key}" not in message
    assert "[redacted]" in message

    log_text = caplog.text
    assert "Gemini generation failed" in log_text
    assert fake_key not in log_text
    assert raw_provider_text not in log_text
    assert "Invalid API key" not in log_text
    assert "Authorization: Bearer" not in log_text
    assert "upstream failed" not in log_text
    assert all(record.exc_info is None for record in caplog.records)
    assert all(getattr(record, "exc_text", None) is None for record in caplog.records)


@pytest.mark.asyncio
async def test_generate_grounded_answer_unexpected_provider_error(
    configured_settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mock_client = MagicMock(spec=GeminiClient)
    mock_client.generate.side_effect = ValueError("boom")
    set_gemini_client(mock_client)

    with caplog.at_level(logging.ERROR, logger="app.services.gemini_service"):
        with pytest.raises(GeminiProviderError, match="boom"):
            await generate_grounded_answer(
                question="What is the refund policy?",
                context="Refunds are available within 14 days.",
            )

    assert "Gemini generation failed" in caplog.text
    assert "boom" not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)


def test_build_http_options_retries_unavailable_errors() -> None:
    options = _build_http_options()
    retry = options.retry_options
    assert retry is not None
    assert retry.attempts == 3
    assert retry.initial_delay == 1.0
    assert retry.max_delay == 2.0
    assert retry.exp_base == 2.0
    assert 503 in (retry.http_status_codes or [])
    assert 429 in (retry.http_status_codes or [])
    assert options.timeout == 15_000


def test_gemini_client_passes_sdk_retry_options(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}

    class FakeModels:
        def generate_content(self, **kwargs):
            captured["generate"] = kwargs
            response = MagicMock()
            response.text = "Grounded reply"
            return response

    class FakeClient:
        def __init__(self, **kwargs):
            captured["client"] = kwargs
            self.models = FakeModels()

    import google.genai as genai_mod

    monkeypatch.setattr(genai_mod, "Client", FakeClient)

    answer = GeminiClient().generate(
        api_key="test-only-key",
        model_name="gemini-3.5-flash-lite",
        system_instruction="Stay grounded.",
        user_prompt="Knowledge context:\n---\nRefunds in 14 days.\n---\n\nCustomer question:\nWhat is the refund policy?\n",
    )

    assert answer == "Grounded reply"
    retry = captured["client"]["http_options"].retry_options
    assert retry.attempts == 3
    assert 503 in retry.http_status_codes
    assert "Refunds in 14 days." in captured["generate"]["contents"]
    assert captured["generate"]["model"] == "gemini-3.5-flash-lite"
