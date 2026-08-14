"""Conversation and message API tests."""

import pytest
from httpx import AsyncClient


SAMPLE_CONVERSATION = {
    "customer_name": "Elena Park",
    "customer_email": "elena@acme.example",
    "subject": "Duplicate March charge",
    "channel": "Chat",
    "status": "Open",
    "initial_message": "I was charged twice for March — can you refund one?",
}


@pytest.mark.asyncio
async def test_list_conversations_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/conversations")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_and_list_conversations(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["customer_name"] == "Elena Park"
    assert body["customer_email"] == "elena@acme.example"
    assert body["subject"] == "Duplicate March charge"
    assert body["status"] == "Open"
    assert body["channel"] == "Chat"
    assert body["last_message"].startswith("I was charged twice")
    assert "id" in body
    assert "owner_id" in body

    listed = await client.get("/api/v1/conversations", headers=auth_headers)
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["id"] == body["id"]


@pytest.mark.asyncio
async def test_get_conversation_by_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    response = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["id"] == conversation_id


@pytest.mark.asyncio
async def test_get_conversation_not_found(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/conversations/does-not-exist",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_conversation_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={"status": "Waiting", "unread_count": 0},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "Waiting"
    assert updated.json()["unread_count"] == 0


@pytest.mark.asyncio
async def test_add_and_list_messages(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    agent_message = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "I can process a $49 refund today.",
            "sender_type": "agent",
            "sender_name": "Maya Chen",
        },
    )
    assert agent_message.status_code == 201
    assert agent_message.json()["sender_type"] == "agent"
    assert agent_message.json()["conversation_id"] == conversation_id

    customer_message = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "Please proceed with the refund.",
            "sender_type": "customer",
        },
    )
    assert customer_message.status_code == 201

    messages = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
    )
    assert messages.status_code == 200
    items = messages.json()
    # initial_message + agent + customer
    assert len(items) == 3
    assert items[0]["sender_type"] == "customer"
    assert items[1]["sender_type"] == "agent"
    assert items[2]["content"] == "Please proceed with the refund."

    conversation = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert conversation.json()["last_message"] == "Please proceed with the refund."
    assert conversation.json()["unread_count"] >= 1


@pytest.mark.asyncio
async def test_messages_for_missing_conversation(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/conversations/missing-id/messages",
        headers=auth_headers,
        json={"content": "Hello", "sender_type": "agent"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_conversations_are_scoped_to_owner(
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
    other_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": other_payload["email"],
            "password": other_payload["password"],
        },
    )
    other_headers = {
        "Authorization": f"Bearer {other_login.json()['access_token']}",
    }

    listed = await client.get("/api/v1/conversations", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json() == []

    detail = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=other_headers,
    )
    assert detail.status_code == 404
