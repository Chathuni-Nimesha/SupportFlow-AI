"""RAG composition service and AI answer API tests."""

import logging
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
)
from app.services.rag_service import (
    INSUFFICIENT_KNOWLEDGE_ANSWER,
    answer_with_rag,
    build_context_from_hits,
    build_sources_from_hits,
)
from app.database.chroma import reset_chroma_client


SAMPLE_HITS = [
    {
        "id": "doc-1::chunk::0",
        "document": "Refunds are available within 14 days of purchase.",
        "metadata": {
            "document_id": "doc-1",
            "owner_id": "owner-a",
            "title": "Refund policy",
            "source": "Internal playbook",
            "status": "Published",
        },
        "distance": 0.1,
        "score": 0.9,
    },
    {
        "id": "doc-1::chunk::1",
        "document": "Refunds are issued to the original payment method.",
        "metadata": {
            "document_id": "doc-1",
            "owner_id": "owner-a",
            "title": "Refund policy",
            "source": "Internal playbook",
            "status": "Published",
        },
        "distance": 0.2,
        "score": 0.8,
    },
    {
        "id": "doc-2::chunk::0",
        "document": "Password resets require email verification.",
        "metadata": {
            "document_id": "doc-2",
            "owner_id": "owner-a",
            "title": "Password reset",
            "source": "",
            "status": "Published",
        },
        "distance": 0.3,
        "score": 0.7,
    },
]


def test_build_context_combines_multiple_chunks() -> None:
    context = build_context_from_hits(SAMPLE_HITS)
    assert "Refunds are available within 14 days of purchase." in context
    assert "Refunds are issued to the original payment method." in context
    assert "Password resets require email verification." in context
    assert "Refund policy" in context
    assert "Document ID: doc-1" in context


def test_build_sources_deduplicates_by_document_id() -> None:
    sources = build_sources_from_hits(SAMPLE_HITS)
    document_ids = [source["document_id"] for source in sources]
    assert document_ids.count("doc-1") == 1
    assert "doc-2" in document_ids
    refund_source = next(source for source in sources if source["document_id"] == "doc-1")
    assert refund_source["score"] == 0.9
    assert refund_source["title"] == "Refund policy"
    assert refund_source["source"] == "Internal playbook"


@pytest.mark.asyncio
async def test_answer_with_rag_success_calls_retrieval_and_gemini() -> None:
    with (
        patch(
            "app.services.rag_service.retrieve_knowledge",
            new_callable=AsyncMock,
            return_value=SAMPLE_HITS,
        ) as retrieve_mock,
        patch(
            "app.services.rag_service.generate_grounded_answer",
            new_callable=AsyncMock,
            return_value="You can request a refund within 14 days.",
        ) as gemini_mock,
    ):
        result = await answer_with_rag(
            workspace_id="workspace-a",
            question="Can I get a refund after 10 days?",
            top_k=5,
        )

    retrieve_mock.assert_awaited_once_with(
        workspace_id="workspace-a",
        query="Can I get a refund after 10 days?",
        top_k=5,
    )
    gemini_mock.assert_awaited_once()
    gemini_kwargs = gemini_mock.await_args.kwargs
    assert gemini_kwargs["question"] == "Can I get a refund after 10 days?"
    assert "Refunds are available within 14 days of purchase." in gemini_kwargs["context"]
    assert "Password resets require email verification." in gemini_kwargs["context"]

    assert result["answer"] == "You can request a refund within 14 days."
    assert result["retrieved_count"] == 3
    assert result["used_generation"] is True
    assert len(result["sources"]) == 2


@pytest.mark.asyncio
async def test_answer_with_rag_no_hits_skips_gemini() -> None:
    with (
        patch(
            "app.services.rag_service.retrieve_knowledge",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.services.rag_service.generate_grounded_answer",
            new_callable=AsyncMock,
        ) as gemini_mock,
    ):
        result = await answer_with_rag(
            workspace_id="workspace-a",
            question="Unknown topic?",
            top_k=5,
        )

    gemini_mock.assert_not_awaited()
    assert result["answer"] == INSUFFICIENT_KNOWLEDGE_ANSWER
    assert result["sources"] == []
    assert result["retrieved_count"] == 0
    assert result["used_generation"] is False


@pytest.mark.asyncio
async def test_answer_with_rag_retrieval_error() -> None:
    with patch(
        "app.services.rag_service.retrieve_knowledge",
        new_callable=AsyncMock,
        side_effect=RuntimeError("chroma down"),
    ):
        from app.services.rag_service import RagRetrievalError

        with pytest.raises(RagRetrievalError):
            await answer_with_rag(
                workspace_id="workspace-a",
                question="Refund policy?",
                top_k=5,
            )


@pytest.mark.asyncio
async def test_answer_with_rag_gemini_configuration_error() -> None:
    with (
        patch(
            "app.services.rag_service.retrieve_knowledge",
            new_callable=AsyncMock,
            return_value=SAMPLE_HITS[:1],
        ),
        patch(
            "app.services.rag_service.generate_grounded_answer",
            new_callable=AsyncMock,
            side_effect=GeminiConfigurationError("Gemini is not configured."),
        ),
    ):
        with pytest.raises(GeminiConfigurationError):
            await answer_with_rag(
                workspace_id="workspace-a",
                question="Refund policy?",
                top_k=5,
            )


@pytest.mark.asyncio
async def test_answer_with_rag_unexpected_gemini_failure_does_not_log_raw_exception(
    caplog: pytest.LogCaptureFixture,
) -> None:
    fake_key = "AIzaSyFakeRagGeminiTestKeyOnly"
    raw_provider_text = (
        f"SDK crashed with api_key={fake_key}. Authorization: Bearer {fake_key}"
    )

    with (
        patch(
            "app.services.rag_service.retrieve_knowledge",
            new_callable=AsyncMock,
            return_value=SAMPLE_HITS[:1],
        ),
        patch(
            "app.services.rag_service.generate_grounded_answer",
            new_callable=AsyncMock,
            side_effect=RuntimeError(raw_provider_text),
        ),
        caplog.at_level(logging.ERROR, logger="app.services.rag_service"),
    ):
        with pytest.raises(GeminiProviderError) as exc_info:
            await answer_with_rag(
                workspace_id="workspace-a",
                question="Refund policy?",
                top_k=5,
            )

    assert str(exc_info.value) == "Answer generation failed. Please try again later."
    assert fake_key not in str(exc_info.value)

    log_text = caplog.text
    assert "Gemini generation failed" in log_text
    assert fake_key not in log_text
    assert raw_provider_text not in log_text
    assert "Authorization: Bearer" not in log_text
    assert all(record.exc_info is None for record in caplog.records)


@pytest.mark.asyncio
async def test_ai_answer_requires_auth(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/ai/answer",
        json={"question": "Can I get a refund?", "top_k": 5},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_ai_answer_endpoint_success(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    with patch(
        "app.api.v1.endpoints.ai.answer_with_rag",
        new_callable=AsyncMock,
        return_value={
            "answer": "Yes, refunds are available within 14 days.",
            "sources": [
                {
                    "document_id": "doc-1",
                    "title": "Refund policy",
                    "source": "Internal playbook",
                    "chunk_id": "doc-1::chunk::0",
                    "score": 0.9,
                    "distance": 0.1,
                    "metadata": {"status": "Published"},
                },
            ],
            "retrieved_count": 1,
            "used_generation": True,
        },
    ) as rag_mock:
        response = await client.post(
            "/api/v1/ai/answer",
            headers=auth_headers,
            json={
                "question": "Can I get a refund after 10 days?",
                "top_k": 5,
                "owner_id": "should-be-ignored",
                "workspace_id": "should-be-ignored",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"].startswith("Yes, refunds")
    assert body["retrieved_count"] == 1
    assert body["used_generation"] is True
    assert body["sources"][0]["document_id"] == "doc-1"

    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    workspace_id = me.json()["default_workspace_id"]
    kwargs = rag_mock.await_args.kwargs
    assert kwargs["workspace_id"] == workspace_id
    assert kwargs["workspace_id"] != "should-be-ignored"
    assert kwargs["workspace_id"] != me.json()["id"]
    assert "owner_id" not in kwargs
    assert kwargs["question"] == "Can I get a refund after 10 days?"
    assert kwargs["top_k"] == 5


@pytest.mark.asyncio
async def test_ai_answer_endpoint_insufficient_knowledge(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    with patch(
        "app.api.v1.endpoints.ai.answer_with_rag",
        new_callable=AsyncMock,
        return_value={
            "answer": INSUFFICIENT_KNOWLEDGE_ANSWER,
            "sources": [],
            "retrieved_count": 0,
            "used_generation": False,
        },
    ):
        response = await client.post(
            "/api/v1/ai/answer",
            headers=auth_headers,
            json={"question": "Do you sell helicopters?", "top_k": 3},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["retrieved_count"] == 0
    assert body["sources"] == []
    assert body["used_generation"] is False
    assert "enough information" in body["answer"].lower()


@pytest.mark.asyncio
async def test_ai_answer_endpoint_rejects_empty_question(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/ai/answer",
        headers=auth_headers,
        json={"question": "   ", "top_k": 5},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ai_answer_endpoint_maps_gemini_config_error(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    with patch(
        "app.api.v1.endpoints.ai.answer_with_rag",
        new_callable=AsyncMock,
        side_effect=GeminiConfigurationError(
            "Gemini is not configured. Set GOOGLE_API_KEY on the server.",
        ),
    ):
        response = await client.post(
            "/api/v1/ai/answer",
            headers=auth_headers,
            json={"question": "Refund policy?", "top_k": 5},
        )

    assert response.status_code == 503
    assert "GOOGLE_API_KEY" in response.json()["detail"]
    assert "AIza" not in response.json()["detail"]


@pytest.mark.asyncio
async def test_ai_answer_endpoint_maps_provider_error(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    with patch(
        "app.api.v1.endpoints.ai.answer_with_rag",
        new_callable=AsyncMock,
        side_effect=GeminiProviderError("upstream unavailable"),
    ):
        response = await client.post(
            "/api/v1/ai/answer",
            headers=auth_headers,
            json={"question": "Refund policy?", "top_k": 5},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "upstream unavailable"


@pytest.mark.asyncio
async def test_rag_cannot_retrieve_other_workspace_knowledge(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json={
            "title": "Refund policy",
            "content": "Customers may request a refund within 14 days of purchase.",
            "status": "Published",
        },
    )
    assert created.status_code == 201
    workspace_a = created.json()["workspace_id"]

    other_payload = {
        **sample_register_payload,
        "email": "rag-other@acme.example",
    }
    await client.post("/api/v1/auth/register", json=other_payload)
    other_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": other_payload["email"],
            "password": other_payload["password"],
        },
    )
    other_me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {other_login.json()['access_token']}"},
    )
    workspace_b = other_me.json()["default_workspace_id"]
    assert workspace_a != workspace_b

    with patch(
        "app.services.rag_service.generate_grounded_answer",
        new_callable=AsyncMock,
        return_value="should not be used for workspace B",
    ) as gemini_mock:
        foreign = await answer_with_rag(
            workspace_id=workspace_b,
            question="What is the refund policy?",
            top_k=5,
        )
    gemini_mock.assert_not_awaited()
    assert foreign["retrieved_count"] == 0
    assert foreign["used_generation"] is False
    assert foreign["answer"] == INSUFFICIENT_KNOWLEDGE_ANSWER

    with patch(
        "app.services.rag_service.generate_grounded_answer",
        new_callable=AsyncMock,
        return_value="Refunds are available within 14 days.",
    ) as gemini_mock:
        local = await answer_with_rag(
            workspace_id=workspace_a,
            question="What is the refund policy?",
            top_k=5,
        )
    gemini_mock.assert_awaited_once()
    assert local["retrieved_count"] >= 1
    assert local["used_generation"] is True
    assert local["sources"][0]["metadata"]["workspace_id"] == workspace_a
