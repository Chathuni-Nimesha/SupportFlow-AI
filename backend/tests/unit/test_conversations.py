"""Conversation and message API tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.conversation import build_conversation_document
from app.models.message import build_message_document


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
    assert body["customer_id"] is None
    assert body["last_message"].startswith("I was charged twice")
    assert "id" in body
    assert "owner_id" in body
    assert "workspace_id" in body

    listed = await client.get("/api/v1/conversations", headers=auth_headers)
    assert listed.status_code == 200
    payload = listed.json()
    items = payload["items"]
    assert payload["page"] == 1
    assert payload["page_size"] == 20
    assert payload["total"] == 1
    assert payload["has_next"] is False
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
async def test_conversations_are_scoped_to_workspace(
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
    assert listed.json()["items"] == []
    assert listed.json()["total"] == 0
    assert listed.json()["has_next"] is False

    detail = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=other_headers,
    )
    assert detail.status_code == 404

    patched = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=other_headers,
        json={"status": "Closed"},
    )
    assert patched.status_code == 404

    messages = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=other_headers,
    )
    assert messages.status_code == 404

    added = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=other_headers,
        json={"content": "Should not land", "sender_type": "agent"},
    )
    assert added.status_code == 404

    still_there = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert still_there.status_code == 200
    owner = await _current_user(client, auth_headers)
    assert still_there.json()["workspace_id"] == owner["default_workspace_id"]
    assert still_there.json()["owner_id"] == owner["id"]


async def _current_user(
    client: AsyncClient,
    headers: dict[str, str],
) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


async def _create_member(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides,
) -> dict:
    payload = {
        "first_name": "Sarah",
        "last_name": "Perera",
        "email": "sarah@acme.example",
        "role": "AGENT",
        "status": "ACTIVE",
        **overrides,
    }
    response = await client.post("/api/v1/team", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def _other_owner_headers(
    client: AsyncClient,
    sample_register_payload: dict,
    email: str = "other-conv-assign@acme.example",
) -> dict[str, str]:
    payload = {**sample_register_payload, "email": email}
    await client.post("/api/v1/auth/register", json=payload)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.mark.asyncio
async def test_create_conversation_assigns_owned_active_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    member = await _create_member(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "assigned_agent_id": member["id"]},
    )
    assert created.status_code == 201, created.text
    assert created.json()["assigned_agent_id"] == member["id"]


@pytest.mark.asyncio
async def test_create_conversation_rejects_unknown_assignee(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "assigned_agent_id": "missing-member"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."


@pytest.mark.asyncio
async def test_create_conversation_rejects_cross_owner_assignee(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    other_headers = await _other_owner_headers(client, sample_register_payload)
    foreign = await _create_member(
        client,
        other_headers,
        email="foreign-agent@acme.example",
    )
    response = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "assigned_agent_id": foreign["id"]},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."


@pytest.mark.asyncio
async def test_create_conversation_rejects_disabled_assignee(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    member = await _create_member(client, auth_headers)
    disabled = await client.patch(
        f"/api/v1/team/{member['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 200

    response = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "assigned_agent_id": member["id"]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Assignee is not an active team member."


@pytest.mark.asyncio
async def test_update_conversation_assigns_and_unassigns_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    member = await _create_member(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]
    assert created.json()["assigned_agent_id"] is None

    assigned = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={"assigned_agent_id": member["id"]},
    )
    assert assigned.status_code == 200
    assert assigned.json()["assigned_agent_id"] == member["id"]

    unassigned = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={"assigned_agent_id": None},
    )
    assert unassigned.status_code == 200
    assert unassigned.json()["assigned_agent_id"] is None


@pytest.mark.asyncio
async def test_update_conversation_reassigns_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    first = await _create_member(client, auth_headers)
    second = await _create_member(
        client,
        auth_headers,
        email="jordan@acme.example",
        first_name="Jordan",
        last_name="Lee",
    )
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "assigned_agent_id": first["id"]},
    )
    conversation_id = created.json()["id"]
    assert created.json()["status"] == "Open"

    reassigned = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={"assigned_agent_id": second["id"]},
    )
    assert reassigned.status_code == 200
    assert reassigned.json()["assigned_agent_id"] == second["id"]
    assert reassigned.json()["status"] == "Open"


@pytest.mark.asyncio
async def test_update_conversation_rejects_foreign_assignee(
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
    other_headers = await _other_owner_headers(
        client,
        sample_register_payload,
        email="other-conv-patch-assign@acme.example",
    )
    foreign = await _create_member(
        client,
        other_headers,
        email="foreign-patch-agent@acme.example",
    )

    response = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={"assigned_agent_id": foreign["id"]},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."

    stored = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert stored.status_code == 200
    assert stored.json()["assigned_agent_id"] is None


@pytest.mark.asyncio
async def test_update_conversation_rejects_inactive_assignee(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    member = await _create_member(client, auth_headers)
    disabled = await client.patch(
        f"/api/v1/team/{member['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 200

    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]

    response = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={"assigned_agent_id": member["id"]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Assignee is not an active team member."

    stored = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert stored.json()["assigned_agent_id"] is None


@pytest.mark.asyncio
async def test_create_conversation_stamps_workspace_and_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["workspace_id"] != me["id"]
    assert body["owner_id"] == me["id"]


@pytest.mark.asyncio
async def test_create_conversation_ignores_client_workspace_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    response = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            **SAMPLE_CONVERSATION,
            "workspace_id": me["id"],
            "owner_id": "forged-owner",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["workspace_id"] != me["id"]
    assert body["owner_id"] == me["id"]


@pytest.mark.asyncio
async def test_update_conversation_ignores_client_workspace_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]
    me = await _current_user(client, auth_headers)

    updated = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={
            "status": "Waiting",
            "workspace_id": me["id"],
            "owner_id": "forged-owner",
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["status"] == "Waiting"
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]


@pytest.mark.asyncio
async def test_backfilled_conversation_is_accessible_in_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    document = build_conversation_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        customer_name="Backfilled Customer",
        customer_email="backfilled@acme.example",
        subject="Seeded before cutover",
        channel="Email",
    )
    message = build_message_document(
        conversation_id=document["_id"],
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        sender_type="customer",
        content="Seeded message",
        sender_name="Backfilled Customer",
    )
    document["last_message"] = message["content"]
    db = mongodb_module.get_database()
    await db.conversations.insert_one(document)
    await db.messages.insert_one(message)

    listed = await client.get("/api/v1/conversations", headers=auth_headers)
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["items"]]
    assert document["_id"] in ids

    detail = await client.get(
        f"/api/v1/conversations/{document['_id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["workspace_id"] == me["default_workspace_id"]
    assert detail.json()["owner_id"] == me["id"]
    assert detail.json()["subject"] == "Seeded before cutover"

    messages = await client.get(
        f"/api/v1/conversations/{document['_id']}/messages",
        headers=auth_headers,
    )
    assert messages.status_code == 200
    assert len(messages.json()) == 1
    assert messages.json()[0]["content"] == "Seeded message"


@pytest.mark.asyncio
async def test_same_workspace_customer_email_linking_still_works(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={
            "first_name": "Elena",
            "last_name": "Park",
            "email": "elena@acme.example",
        },
    )
    assert customer.status_code == 201

    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    assert created.status_code == 201
    assert created.json()["customer_email"] == "elena@acme.example"
    assert created.json()["customer_id"] == customer.json()["id"]

    updated = await client.patch(
        f"/api/v1/conversations/{created.json()['id']}",
        headers=auth_headers,
        json={"customer_email": "elena@acme.example", "customer_name": "Elena Park"},
    )
    assert updated.status_code == 200
    assert updated.json()["customer_email"] == "elena@acme.example"
    assert updated.json()["customer_id"] == customer.json()["id"]


@pytest.mark.asyncio
async def test_conversation_cannot_attach_foreign_customer_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    """Foreign workspace customer_id is rejected and does not create a thread."""
    other_headers = await _other_owner_headers(
        client,
        sample_register_payload,
        email="other-conv-customer@acme.example",
    )
    foreign_customer = await client.post(
        "/api/v1/customers",
        headers=other_headers,
        json={
            "first_name": "Foreign",
            "last_name": "Customer",
            "email": "foreign-customer@acme.example",
        },
    )
    assert foreign_customer.status_code == 201
    foreign_id = foreign_customer.json()["id"]

    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            **SAMPLE_CONVERSATION,
            "customer_id": foreign_id,
        },
    )
    assert created.status_code == 404
    assert created.json()["detail"] == "Customer not found."

    listed = await client.get("/api/v1/conversations", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    assert listed.json()["total"] == 0


@pytest.mark.asyncio
async def test_same_workspace_message_create_and_list_still_works(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    conversation_id = created.json()["id"]
    me = await _current_user(client, auth_headers)

    listed = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    added = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Workspace-scoped reply", "sender_type": "agent"},
    )
    assert added.status_code == 201
    assert added.json()["conversation_id"] == conversation_id

    after = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=auth_headers,
    )
    assert after.status_code == 200
    assert len(after.json()) == 2

    detail = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert detail.json()["workspace_id"] == me["default_workspace_id"]
    assert detail.json()["last_message"] == "Workspace-scoped reply"


@pytest.mark.asyncio
async def test_conversation_list_pagination_still_works(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    for index in range(3):
        created = await client.post(
            "/api/v1/conversations",
            headers=auth_headers,
            json={
                **SAMPLE_CONVERSATION,
                "customer_email": f"page{index}@acme.example",
                "subject": f"Page subject {index}",
            },
        )
        assert created.status_code == 201

    response = await client.get(
        "/api/v1/conversations",
        headers=auth_headers,
        params={"page": 1, "page_size": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["items"]) == 2
    assert body["has_next"] is True
