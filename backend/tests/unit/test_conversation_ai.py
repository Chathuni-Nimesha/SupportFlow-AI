"""Conversation AI suggested-reply API tests."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.conversation import ConversationMessageResponse
from app.services.conversation_ai_service import (
    ConversationAiValidationError,
    find_latest_customer_message,
    suggest_reply,
)
from app.services.gemini_service import GeminiConfigurationError, GeminiProviderError
from app.services.rag_service import (
    INSUFFICIENT_KNOWLEDGE_ANSWER,
    RagRetrievalError,
)


SAMPLE_CONVERSATION = {
    "customer_name": "Elena Park",
    "customer_email": "elena@acme.example",
    "subject": "Refund after 10 days",
    "channel": "Chat",
    "status": "Open",
    "initial_message": "Can I get a refund after 10 days?",
}


def _msg(
    *,
    message_id: str,
    sender_type: str,
    content: str,
    conversation_id: str = "conv-1",
) -> ConversationMessageResponse:
    return ConversationMessageResponse(
        id=message_id,
        conversation_id=conversation_id,
        sender_type=sender_type,  # type: ignore[arg-type]
        sender_name=None,
        content=content,
        created_at=datetime.now(timezone.utc),
    )


def test_find_latest_customer_message_skips_agent_and_ai() -> None:
    messages = [
        _msg(message_id="m1", sender_type="customer", content="First question"),
        _msg(message_id="m2", sender_type="agent", content="Agent reply"),
        _msg(message_id="m3", sender_type="ai", content="AI draft"),
        _msg(message_id="m4", sender_type="customer", content="Follow-up question"),
        _msg(message_id="m5", sender_type="agent", content="Latest agent note"),
    ]
    latest = find_latest_customer_message(messages)
    assert latest is not None
    assert latest.id == "m4"
    assert latest.content == "Follow-up question"


def test_find_latest_customer_message_none_when_only_agent() -> None:
    messages = [
        _msg(message_id="m1", sender_type="agent", content="Hello"),
        _msg(message_id="m2", sender_type="ai", content="Draft"),
    ]
    assert find_latest_customer_message(messages) is None


@pytest.mark.asyncio
async def test_suggest_reply_calls_rag_with_latest_customer_message() -> None:
    messages = [
        _msg(message_id="m1", sender_type="customer", content="Old question"),
        _msg(message_id="m2", sender_type="agent", content="Agent reply"),
        _msg(message_id="m3", sender_type="customer", content="Can I get a refund?"),
    ]

    with (
        patch(
            "app.services.conversation_ai_service.conversation_service.list_messages",
            new_callable=AsyncMock,
            return_value=messages,
        ),
        patch(
            "app.services.conversation_ai_service.answer_with_rag",
            new_callable=AsyncMock,
            return_value={
                "answer": "Yes, refunds are available within 14 days.",
                "sources": [{"document_id": "doc-1", "title": "Refunds", "score": 0.9}],
                "retrieved_count": 1,
                "used_generation": True,
            },
        ) as rag_mock,
    ):
        result = await suggest_reply(
            conversation_id="conv-1",
            owner_id="owner-a",
            top_k=5,
        )

    rag_mock.assert_awaited_once_with(
        owner_id="owner-a",
        question="Can I get a refund?",
        top_k=5,
    )
    assert result["suggested_reply"].startswith("Yes, refunds")
    assert result["customer_message_id"] == "m3"
    assert result["conversation_id"] == "conv-1"
    assert result["retrieved_count"] == 1
    assert result["used_generation"] is True


@pytest.mark.asyncio
async def test_suggest_reply_no_customer_message_skips_rag() -> None:
    with (
        patch(
            "app.services.conversation_ai_service.conversation_service.list_messages",
            new_callable=AsyncMock,
            return_value=[
                _msg(message_id="m1", sender_type="agent", content="Only agent"),
            ],
        ),
        patch(
            "app.services.conversation_ai_service.answer_with_rag",
            new_callable=AsyncMock,
        ) as rag_mock,
    ):
        with pytest.raises(ConversationAiValidationError):
            await suggest_reply(
                conversation_id="conv-1",
                owner_id="owner-a",
                top_k=5,
            )

    rag_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_suggest_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/v1/conversations/any-id/ai/suggest", json={})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_suggest_endpoint_success(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]
    status_before = created.json()["status"]
    unread_before = created.json()["unread_count"]

    await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "I can help with that.",
            "sender_type": "agent",
            "sender_name": "Maya",
        },
    )
    latest_customer = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "What is the refund window?",
            "sender_type": "customer",
        },
    )
    latest_customer_id = latest_customer.json()["id"]

    messages_before = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
    )
    message_count_before = len(messages_before.json())

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
        return_value={
            "answer": "Refunds are available within 14 days of purchase.",
            "sources": [
                {
                    "document_id": "doc-1",
                    "title": "Refund policy",
                    "source": "Playbook",
                    "chunk_id": "doc-1::0",
                    "score": 0.91,
                    "distance": 0.09,
                    "metadata": {"status": "Published"},
                },
            ],
            "retrieved_count": 1,
            "used_generation": True,
        },
    ) as rag_mock:
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=auth_headers,
            json={
                "top_k": 4,
                "owner_id": "should-be-ignored",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["conversation_id"] == conversation_id
    assert body["suggested_reply"].startswith("Refunds are available")
    assert body["retrieved_count"] == 1
    assert body["used_generation"] is True
    assert body["customer_message_id"] == latest_customer_id
    assert body["sources"][0]["document_id"] == "doc-1"

    kwargs = rag_mock.await_args.kwargs
    assert kwargs["owner_id"] != "should-be-ignored"
    assert kwargs["question"] == "What is the refund window?"
    assert kwargs["top_k"] == 4

    messages_after = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
    )
    assert len(messages_after.json()) == message_count_before

    conversation_after = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert conversation_after.json()["status"] == status_before
    assert conversation_after.json()["unread_count"] == unread_before + 1


@pytest.mark.asyncio
async def test_suggest_uses_latest_customer_not_agent(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            **SAMPLE_CONVERSATION,
            "initial_message": "Original customer question",
        },
    )
    conversation_id = created.json()["id"]

    await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Agent thinks this is the question", "sender_type": "agent"},
    )

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
        return_value={
            "answer": "Grounded answer",
            "sources": [],
            "retrieved_count": 1,
            "used_generation": True,
        },
    ) as rag_mock:
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=auth_headers,
            json={},
        )

    assert response.status_code == 200
    assert rag_mock.await_args.kwargs["question"] == "Original customer question"
    assert rag_mock.await_args.kwargs["question"] != "Agent thinks this is the question"


@pytest.mark.asyncio
async def test_suggest_owner_isolation(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    other_payload = {
        **sample_register_payload,
        "email": "other@acme.example",
    }
    await client.post("/api/v1/auth/register", json=other_payload)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": other_payload["email"], "password": other_payload["password"]},
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
    ) as rag_mock:
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=other_headers,
            json={},
        )

    assert response.status_code == 404
    rag_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_suggest_conversation_not_found(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/conversations/missing-conversation/ai/suggest",
        headers=auth_headers,
        json={},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_suggest_no_customer_message(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            "customer_name": "Elena Park",
            "customer_email": "elena@acme.example",
            "subject": "No customer msgs",
            "channel": "Chat",
            "status": "Open",
        },
    )
    conversation_id = created.json()["id"]
    await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Agent-only note", "sender_type": "agent"},
    )

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
    ) as rag_mock:
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=auth_headers,
            json={},
        )

    assert response.status_code == 400
    assert "customer message" in response.json()["detail"].lower()
    rag_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_suggest_insufficient_knowledge(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
        return_value={
            "answer": INSUFFICIENT_KNOWLEDGE_ANSWER,
            "sources": [],
            "retrieved_count": 0,
            "used_generation": False,
        },
    ):
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=auth_headers,
            json={},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["suggested_reply"] == INSUFFICIENT_KNOWLEDGE_ANSWER
    assert body["sources"] == []
    assert body["retrieved_count"] == 0
    assert body["used_generation"] is False


@pytest.mark.asyncio
async def test_suggest_rag_retrieval_failure(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
        side_effect=RagRetrievalError("Knowledge retrieval failed."),
    ):
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=auth_headers,
            json={},
        )

    assert response.status_code == 503


@pytest.mark.asyncio
async def test_suggest_gemini_configuration_failure(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
        side_effect=GeminiConfigurationError("Gemini is not configured."),
    ):
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=auth_headers,
            json={},
        )

    assert response.status_code == 503


@pytest.mark.asyncio
async def test_suggest_gemini_provider_failure(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    with patch(
        "app.services.conversation_ai_service.answer_with_rag",
        new_callable=AsyncMock,
        side_effect=GeminiProviderError("Answer generation failed."),
    ):
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/ai/suggest",
            headers=auth_headers,
            json={},
        )

    assert response.status_code == 503
