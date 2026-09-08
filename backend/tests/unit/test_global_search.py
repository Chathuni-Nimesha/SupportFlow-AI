"""Global workspace search API tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.conversation import build_conversation_document
from app.models.customer import build_customer_document
from app.models.knowledge import build_knowledge_document
from app.models.message import build_message_document
from app.models.ticket import build_ticket_document
from app.services.global_search_service import (
    EMPTY_QUERY_DETAIL,
    QUERY_TOO_SHORT_DETAIL,
)
from tests.role_helpers import headers_as_workspace_role


async def _me(client: AsyncClient, headers: dict[str, str]) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


async def _other_headers(
    client: AsyncClient,
    sample_register_payload: dict,
    email: str = "other-search@acme.example",
) -> dict[str, str]:
    other_payload = {**sample_register_payload, "email": email}
    await client.post("/api/v1/auth/register", json=other_payload)
    other_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": other_payload["email"],
            "password": other_payload["password"],
        },
    )
    return {"Authorization": f"Bearer {other_login.json()['access_token']}"}


@pytest.mark.asyncio
async def test_global_search_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/search", params={"q": "refund"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_global_search_rejects_empty_query(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/search",
        headers=auth_headers,
        params={"q": "   "},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == EMPTY_QUERY_DETAIL


@pytest.mark.asyncio
async def test_global_search_rejects_short_query(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/search",
        headers=auth_headers,
        params={"q": "a"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == QUERY_TOO_SHORT_DETAIL


@pytest.mark.asyncio
async def test_global_search_matches_all_resource_types(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    owner_id = me["id"]
    workspace_id = me["default_workspace_id"]
    db = mongodb_module.get_database()

    customer = build_customer_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        first_name="Olivia",
        last_name="Carter",
        email="olivia.carter@search.example",
        company="Refund Labs",
    )
    await db.customers.insert_one(customer)

    conversation = build_conversation_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customer_id=str(customer["_id"]),
        customer_name="Olivia Carter",
        customer_email="olivia.carter@search.example",
        subject="Refund request for recent order",
        channel="Email",
        status="Open",
    )
    await db.conversations.insert_one(conversation)
    message = build_message_document(
        conversation_id=str(conversation["_id"]),
        owner_id=owner_id,
        workspace_id=workspace_id,
        sender_type="customer",
        content="Please process my refund for unused seats.",
        sender_name="Olivia Carter",
    )
    await db.messages.insert_one(message)

    ticket = build_ticket_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customer_id=str(customer["_id"]),
        conversation_id=str(conversation["_id"]),
        title="Prorated refund for unused seats",
        description="Customer asked for a refund credit.",
        status="OPEN",
        priority="HIGH",
    )
    await db.tickets.insert_one(ticket)

    knowledge = build_knowledge_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        title="Refund and Cancellation Policy",
        content="Customers may request a refund within 14 days.",
        status="Published",
        tags=["refunds", "billing"],
    )
    await db.knowledge_documents.insert_one(knowledge)

    response = await client.get(
        "/api/v1/search",
        headers=auth_headers,
        params={"q": "refund"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "refund"
    assert any(item["id"] == str(conversation["_id"]) for item in payload["conversations"])
    assert any(item["id"] == str(ticket["_id"]) for item in payload["tickets"])
    assert any(item["id"] == str(customer["_id"]) for item in payload["customers"])
    assert any(item["id"] == str(knowledge["_id"]) for item in payload["knowledge"])

    conversation_hit = next(
        item for item in payload["conversations"] if item["id"] == str(conversation["_id"])
    )
    assert conversation_hit["href"].endswith(
        f"?conversation={conversation['_id']}",
    )
    assert "password" not in str(payload).lower()
    assert "jwt" not in str(payload).lower()


@pytest.mark.asyncio
async def test_global_search_finds_conversation_via_message_content(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    owner_id = me["id"]
    workspace_id = me["default_workspace_id"]
    db = mongodb_module.get_database()

    conversation = build_conversation_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customer_name="Amelia Davis",
        customer_email="amelia@search.example",
        subject="Login help",
        channel="Chat",
    )
    await db.conversations.insert_one(conversation)
    await db.messages.insert_one(
        build_message_document(
            conversation_id=str(conversation["_id"]),
            owner_id=owner_id,
            workspace_id=workspace_id,
            sender_type="customer",
            content="UniqueZebraPhrase never arrives in my inbox.",
            sender_name="Amelia Davis",
        ),
    )

    response = await client.get(
        "/api/v1/search",
        headers=auth_headers,
        params={"q": "UniqueZebraPhrase"},
    )
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["conversations"]]
    assert str(conversation["_id"]) in ids


@pytest.mark.asyncio
async def test_global_search_no_results(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/search",
        headers=auth_headers,
        params={"q": "zzznomatchxyz"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["conversations"] == []
    assert payload["tickets"] == []
    assert payload["customers"] == []
    assert payload["knowledge"] == []


@pytest.mark.asyncio
async def test_global_search_isolates_by_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    me = await _me(client, auth_headers)
    owner_id = me["id"]
    workspace_id = me["default_workspace_id"]
    other = await _other_headers(client, sample_register_payload)
    other_me = await _me(client, other)
    other_workspace = other_me["default_workspace_id"]
    db = mongodb_module.get_database()

    await db.customers.insert_one(
        build_customer_document(
            owner_id=owner_id,
            workspace_id=workspace_id,
            first_name="Mine",
            last_name="Customer",
            email="mine.search@example.com",
        ),
    )
    foreign = build_customer_document(
        owner_id=other_me["id"],
        workspace_id=other_workspace,
        first_name="Foreign",
        last_name="Customer",
        email="foreign.search@example.com",
    )
    # Same distinctive token in foreign workspace only for knowledge/ticket too.
    await db.customers.insert_one(foreign)
    await db.tickets.insert_one(
        build_ticket_document(
            owner_id=other_me["id"],
            workspace_id=other_workspace,
            customer_id=str(foreign["_id"]),
            title="ForeignUniqueToken billing issue",
            description="Should not leak across workspaces.",
        ),
    )
    await db.knowledge_documents.insert_one(
        build_knowledge_document(
            owner_id=other_me["id"],
            workspace_id=other_workspace,
            title="ForeignUniqueToken policy",
            content="Secret foreign knowledge.",
            status="Published",
        ),
    )
    await db.conversations.insert_one(
        build_conversation_document(
            owner_id=other_me["id"],
            workspace_id=other_workspace,
            customer_name="Foreign Customer",
            customer_email="foreign.search@example.com",
            subject="ForeignUniqueToken conversation",
            channel="Email",
        ),
    )

    response = await client.get(
        "/api/v1/search",
        headers=auth_headers,
        params={"q": "ForeignUniqueToken"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["conversations"] == []
    assert payload["tickets"] == []
    assert payload["customers"] == []
    assert payload["knowledge"] == []


@pytest.mark.asyncio
async def test_agent_can_global_search(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    me = await _me(client, auth_headers)
    owner_id = me["id"]
    workspace_id = me["default_workspace_id"]
    _agent_user, agent_headers = await headers_as_workspace_role(
        client,
        sample_register_payload,
        email="search-agent@acme.example",
        role="AGENT",
        workspace_id=workspace_id,
        owner_id=owner_id,
    )
    # Point the agent at the owner's workspace as current tenant.
    select = await client.post(
        f"/api/v1/workspaces/{workspace_id}/select",
        headers=agent_headers,
    )
    assert select.status_code == 200, select.text

    db = mongodb_module.get_database()
    await db.customers.insert_one(
        build_customer_document(
            owner_id=owner_id,
            workspace_id=workspace_id,
            first_name="AgentVisible",
            last_name="Person",
            email="agent.visible@example.com",
        ),
    )

    response = await client.get(
        "/api/v1/search",
        headers=agent_headers,
        params={"q": "AgentVisible"},
    )
    assert response.status_code == 200
    assert len(response.json()["customers"]) == 1
