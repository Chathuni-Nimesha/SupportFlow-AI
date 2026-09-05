"""Ticket customer/conversation consistency and isolation tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.ticket import build_ticket_document
from app.services.ticket_service import TICKET_CONVERSATION_CUSTOMER_MISMATCH


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
async def test_create_ticket_with_same_workspace_customer_succeeds(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    assert created["customer_id"] == customer["id"]
    assert created["conversation_id"] is None


@pytest.mark.asyncio
async def test_create_ticket_with_foreign_workspace_customer_returns_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-ticket-cust-create@acme.example",
    )
    foreign = await _create_customer(
        client,
        other_headers,
        email="foreign-create@acme.example",
    )

    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={**SAMPLE_TICKET, "customer_id": foreign["id"]},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found."
    listed = await client.get("/api/v1/tickets", headers=auth_headers)
    assert listed.json()["items"] == []


@pytest.mark.asyncio
async def test_update_ticket_with_same_workspace_customer_succeeds(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    first = await _create_customer(client, auth_headers)
    second = await _create_customer(
        client,
        auth_headers,
        email="noah@orbit.example",
        first_name="Noah",
    )
    created = await _create_ticket(client, auth_headers, first["id"])
    updated = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"customer_id": second["id"]},
    )
    assert updated.status_code == 200
    assert updated.json()["customer_id"] == second["id"]


@pytest.mark.asyncio
async def test_update_ticket_foreign_customer_does_not_modify_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-ticket-cust-update@acme.example",
    )
    foreign = await _create_customer(
        client,
        other_headers,
        email="foreign-update-cust@acme.example",
    )

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"customer_id": foreign["id"], "status": "CLOSED"},
    )
    assert response.status_code == 404
    detail = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert detail.json()["customer_id"] == customer["id"]
    assert detail.json()["status"] == "OPEN"


@pytest.mark.asyncio
async def test_customer_id_null_does_not_unlink_required_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])

    only_null = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"customer_id": None},
    )
    assert only_null.status_code == 400

    with_status = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"customer_id": None, "status": "PENDING"},
    )
    assert with_status.status_code == 200
    body = with_status.json()
    assert body["customer_id"] == customer["id"]
    assert body["status"] == "PENDING"


@pytest.mark.asyncio
async def test_create_ticket_with_matching_customer_and_conversation_succeeds(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    assert conversation["customer_id"] == customer["id"]
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert created["customer_id"] == customer["id"]
    assert created["conversation_id"] == conversation["id"]


@pytest.mark.asyncio
async def test_create_ticket_allows_unlinked_conversation_with_independent_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_email="unlinked-thread@acme.example",
    )
    assert conversation["customer_id"] is None
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert created["customer_id"] == customer["id"]
    assert created["conversation_id"] == conversation["id"]


@pytest.mark.asyncio
async def test_create_rejects_conversation_customer_mismatch(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    ticket_customer = await _create_customer(client, auth_headers)
    conversation_customer = await _create_customer(
        client,
        auth_headers,
        email="other-local@acme.example",
        first_name="Other",
    )
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=conversation_customer["id"],
        customer_email=conversation_customer["email"],
        customer_name="Other Local",
    )

    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": ticket_customer["id"],
            "conversation_id": conversation["id"],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == TICKET_CONVERSATION_CUSTOMER_MISMATCH
    listed = await client.get("/api/v1/tickets", headers=auth_headers)
    assert listed.json()["items"] == []


@pytest.mark.asyncio
async def test_update_rejects_conversation_customer_mismatch_and_leaves_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    ticket_customer = await _create_customer(client, auth_headers)
    other_customer = await _create_customer(
        client,
        auth_headers,
        email="other-update@acme.example",
        first_name="Other",
    )
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=other_customer["id"],
        customer_email=other_customer["email"],
    )
    created = await _create_ticket(client, auth_headers, ticket_customer["id"])

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"conversation_id": conversation["id"], "status": "CLOSED"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == TICKET_CONVERSATION_CUSTOMER_MISMATCH
    detail = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert detail.json()["conversation_id"] is None
    assert detail.json()["customer_id"] == ticket_customer["id"]
    assert detail.json()["status"] == "OPEN"


@pytest.mark.asyncio
async def test_foreign_conversation_reference_remains_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-ticket-conv-2d@acme.example",
    )
    foreign = await _create_conversation(
        client,
        other_headers,
        customer_email="foreign-2d@acme.example",
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


@pytest.mark.asyncio
async def test_client_workspace_id_cannot_override_current_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    created = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "conversation_id": conversation["id"],
            "workspace_id": me["id"],
            "owner_id": "forged-owner",
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]
    assert body["customer_id"] == customer["id"]
    assert body["conversation_id"] == conversation["id"]


@pytest.mark.asyncio
async def test_legacy_tickets_without_customer_or_conversation_remain_readable(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    missing_conversation = build_ticket_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        customer_id="legacy-customer",
        title="Has customer only",
        description="No conversation_id field.",
    )
    assert "conversation_id" not in missing_conversation
    missing_customer = {
        "_id": "legacy-ticket-no-customer",
        "owner_id": me["id"],
        "workspace_id": me["default_workspace_id"],
        "title": "No customer field",
        "description": "Seeded without customer_id.",
        "status": "OPEN",
        "priority": "LOW",
        "assignee_id": None,
        "created_at": missing_conversation["created_at"],
        "updated_at": missing_conversation["updated_at"],
    }
    db = mongodb_module.get_database()
    await db.tickets.insert_one(missing_conversation)
    await db.tickets.insert_one(missing_customer)

    first = await client.get(
        f"/api/v1/tickets/{missing_conversation['_id']}",
        headers=auth_headers,
    )
    assert first.status_code == 200
    assert first.json()["customer_id"] == "legacy-customer"
    assert first.json()["conversation_id"] is None

    second = await client.get(
        f"/api/v1/tickets/{missing_customer['_id']}",
        headers=auth_headers,
    )
    assert second.status_code == 200
    assert second.json()["customer_id"] is None
    assert second.json()["conversation_id"] is None
    assert second.json()["title"] == "No customer field"


@pytest.mark.asyncio
async def test_customer_delete_does_not_cascade_tickets(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    deleted = await client.delete(
        f"/api/v1/customers/{customer['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204
    detail = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["customer_id"] == customer["id"]
    assert detail.json()["customer"] is None


@pytest.mark.asyncio
async def test_conversation_delete_endpoint_does_not_exist(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    conversation = await _create_conversation(client, auth_headers)
    response = await client.delete(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
    )
    assert response.status_code in {404, 405}
    detail = await client.get(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
