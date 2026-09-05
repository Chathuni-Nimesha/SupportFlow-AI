"""Workspace-safe ticket.conversation_id relationship tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.ticket import build_ticket_document


SAMPLE_CUSTOMER = {
    "first_name": "Elena",
    "last_name": "Park",
    "email": "elena@acme.example",
}

SAMPLE_TICKET = {
    "title": "Refund not received",
    "description": "Customer paid twice and needs the duplicate charge reversed.",
    "status": "OPEN",
    "priority": "HIGH",
}

SAMPLE_CONVERSATION = {
    "customer_name": "Elena Park",
    "customer_email": "elena@acme.example",
    "subject": "Duplicate March charge",
    "channel": "Chat",
    "status": "Open",
}


async def _me(client: AsyncClient, headers: dict[str, str]) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


async def _other_headers(
    client: AsyncClient,
    sample_register_payload: dict,
    email: str,
) -> dict[str, str]:
    payload = {**sample_register_payload, "email": email}
    await client.post("/api/v1/auth/register", json=payload)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _create_customer(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides,
) -> dict:
    response = await client.post(
        "/api/v1/customers",
        headers=headers,
        json={**SAMPLE_CUSTOMER, **overrides},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _create_conversation(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides,
) -> dict:
    response = await client.post(
        "/api/v1/conversations",
        headers=headers,
        json={**SAMPLE_CONVERSATION, **overrides},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _create_ticket(
    client: AsyncClient,
    headers: dict[str, str],
    customer_id: str,
    **overrides,
) -> dict:
    payload = {**SAMPLE_TICKET, "customer_id": customer_id, **overrides}
    response = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_create_ticket_with_same_workspace_conversation(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(client, auth_headers)
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert created["conversation_id"] == conversation["id"]
    assert created["customer_id"] == customer["id"]
    assert created["workspace_id"] == conversation["workspace_id"]


@pytest.mark.asyncio
async def test_create_ticket_without_conversation_id_succeeds(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    assert created["conversation_id"] is None
    stored = await mongodb_module.get_database().tickets.find_one(
        {"_id": created["id"]},
    )
    assert stored is not None
    assert "conversation_id" not in stored or stored.get("conversation_id") in (
        None,
        "",
    )


@pytest.mark.asyncio
async def test_create_ticket_with_foreign_conversation_id_returns_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-ticket-conv@acme.example",
    )
    foreign = await _create_conversation(
        client,
        other_headers,
        customer_email="foreign-thread@acme.example",
    )

    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "conversation_id": foreign["id"],
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found."

    listed = await client.get("/api/v1/tickets", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    assert listed.json()["total"] == 0


@pytest.mark.asyncio
async def test_update_ticket_with_same_workspace_conversation_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    first = await _create_conversation(client, auth_headers)
    second = await _create_conversation(
        client,
        auth_headers,
        customer_email="second-thread@acme.example",
        subject="Second thread",
    )
    created = await _create_ticket(client, auth_headers, customer["id"])
    assert created["conversation_id"] is None

    linked = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"conversation_id": first["id"]},
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["conversation_id"] == first["id"]

    changed = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"conversation_id": second["id"]},
    )
    assert changed.status_code == 200
    assert changed.json()["conversation_id"] == second["id"]
    assert changed.json()["customer_id"] == customer["id"]


@pytest.mark.asyncio
async def test_update_ticket_with_foreign_conversation_id_returns_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    local = await _create_conversation(client, auth_headers)
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=local["id"],
    )

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-ticket-conv-update@acme.example",
    )
    foreign = await _create_conversation(
        client,
        other_headers,
        customer_email="foreign-update@acme.example",
    )

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"conversation_id": foreign["id"], "status": "CLOSED"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found."

    detail = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["conversation_id"] == local["id"]
    assert body["status"] == "OPEN"


@pytest.mark.asyncio
async def test_update_ticket_with_null_conversation_id_unlinks(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(client, auth_headers)
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert created["conversation_id"] == conversation["id"]

    unlinked = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"conversation_id": None},
    )
    assert unlinked.status_code == 200
    assert unlinked.json()["conversation_id"] is None

    stored = await mongodb_module.get_database().tickets.find_one(
        {"_id": created["id"]},
    )
    assert stored is not None
    assert stored.get("conversation_id") in (None, "")
    assert stored["customer_id"] == customer["id"]
    assert stored["title"] == SAMPLE_TICKET["title"]


@pytest.mark.asyncio
async def test_create_ticket_ignores_client_workspace_id_when_linking_conversation(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    me = await _me(client, auth_headers)
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(client, auth_headers)
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "forge-ticket-conv@acme.example",
    )
    other = await _me(client, other_headers)

    created = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "conversation_id": conversation["id"],
            "workspace_id": other["default_workspace_id"],
            "owner_id": other["id"],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["conversation_id"] == conversation["id"]
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]
    assert body["workspace_id"] != other["default_workspace_id"]
    assert body["owner_id"] != other["id"]


@pytest.mark.asyncio
async def test_existing_ticket_without_conversation_id_remains_readable(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    me = await _me(client, auth_headers)
    document = build_ticket_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        customer_id=customer["id"],
        title="Legacy unlinked ticket",
        description="Seeded without conversation_id.",
    )
    assert "conversation_id" not in document
    await mongodb_module.get_database().tickets.insert_one(document)

    detail = await client.get(
        f"/api/v1/tickets/{document['_id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == document["_id"]
    assert body["conversation_id"] is None
    assert body["customer_id"] == customer["id"]
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]


@pytest.mark.asyncio
async def test_ticket_conversation_link_stays_in_current_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(client, auth_headers)
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-ticket-isolation@acme.example",
    )
    listed = await client.get("/api/v1/tickets", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json()["items"] == []

    detail = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=other_headers,
    )
    assert detail.status_code == 404

    patched = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=other_headers,
        json={"conversation_id": None},
    )
    assert patched.status_code == 404

    still_there = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert still_there.status_code == 200
    assert still_there.json()["conversation_id"] == conversation["id"]


@pytest.mark.asyncio
async def test_list_tickets_filters_by_conversation_id_in_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    other_conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
        subject="Unrelated thread",
        customer_email="elena@acme.example",
    )
    linked = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
        title="Linked refund ticket",
    )
    await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=other_conversation["id"],
        title="Other thread ticket",
    )
    unlinked = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        title="No conversation ticket",
    )

    listed = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"conversation_id": conversation["id"]},
    )
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["items"]]
    assert ids == [linked["id"]]
    assert unlinked["id"] not in ids


@pytest.mark.asyncio
async def test_list_tickets_conversation_filter_stays_workspace_scoped(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    local = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
        title="Local linked ticket",
    )

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-conversation-filter@acme.example",
    )
    other_customer = await _create_customer(
        client,
        other_headers,
        email="other-filter@acme.example",
    )
    foreign_conversation = await _create_conversation(
        client,
        other_headers,
        customer_id=other_customer["id"],
        customer_email="other-filter@acme.example",
        customer_name="Other User",
    )
    foreign = await _create_ticket(
        client,
        other_headers,
        other_customer["id"],
        conversation_id=foreign_conversation["id"],
        title="Foreign linked ticket",
    )

    leaked = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"conversation_id": foreign_conversation["id"]},
    )
    assert leaked.status_code == 200
    assert leaked.json()["items"] == []

    other_listed = await client.get(
        "/api/v1/tickets",
        headers=other_headers,
        params={"conversation_id": conversation["id"]},
    )
    assert other_listed.status_code == 200
    assert other_listed.json()["items"] == []

    local_listed = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"conversation_id": conversation["id"]},
    )
    assert [item["id"] for item in local_listed.json()["items"]] == [local["id"]]
    assert foreign["id"] not in [
        item["id"] for item in local_listed.json()["items"]
    ]

    ignored = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={
            "conversation_id": conversation["id"],
            "workspace_id": "forged-workspace",
        },
    )
    assert ignored.status_code == 200
    assert [item["id"] for item in ignored.json()["items"]] == [local["id"]]
