"""Phase 3A: assignment inheritance and resolution coherence."""

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


async def _assign_conversation(
    client: AsyncClient,
    headers: dict[str, str],
    conversation_id: str,
    assignee_id: str | None,
) -> dict:
    response = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=headers,
        json={"assigned_agent_id": assignee_id},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_create_ticket_from_conversation_inherits_active_assignee(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    member = await _create_member(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    await _assign_conversation(
        client,
        auth_headers,
        conversation["id"],
        member["id"],
    )

    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert created["assignee_id"] == member["id"]
    assert created["conversation_id"] == conversation["id"]

    stored_conversation = await client.get(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
    )
    assert stored_conversation.status_code == 200
    assert stored_conversation.json()["assigned_agent_id"] == member["id"]
    assert stored_conversation.json()["status"] == "Open"


@pytest.mark.asyncio
async def test_create_ticket_from_conversation_does_not_inherit_when_unassigned(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    assert conversation["assigned_agent_id"] is None

    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert created["assignee_id"] is None


@pytest.mark.asyncio
async def test_create_ticket_skips_inactive_conversation_assignee(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    member = await _create_member(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    await _assign_conversation(
        client,
        auth_headers,
        conversation["id"],
        member["id"],
    )
    disabled = await client.patch(
        f"/api/v1/team/{member['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 200

    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert created["assignee_id"] is None
    stored_conversation = await client.get(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
    )
    assert stored_conversation.json()["assigned_agent_id"] == member["id"]


@pytest.mark.asyncio
async def test_explicit_foreign_assignee_is_rejected_without_write(
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
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-assign-res@acme.example",
    )
    foreign = await _create_member(
        client,
        other_headers,
        email="foreign-agent@acme.example",
    )
    before = await mongodb_module.get_database().tickets.count_documents({})

    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "conversation_id": conversation["id"],
            "assignee_id": foreign["id"],
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."
    after = await mongodb_module.get_database().tickets.count_documents({})
    assert after == before


@pytest.mark.asyncio
async def test_explicit_inactive_assignee_is_rejected_without_write(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    member = await _create_member(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    disabled = await client.patch(
        f"/api/v1/team/{member['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 200
    before = await mongodb_module.get_database().tickets.count_documents({})

    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "conversation_id": conversation["id"],
            "assignee_id": member["id"],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Assignee is not an active team member."
    after = await mongodb_module.get_database().tickets.count_documents({})
    assert after == before


@pytest.mark.asyncio
async def test_ticket_reassignment_does_not_change_conversation_assignee(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation_agent = await _create_member(
        client,
        auth_headers,
        email="conversation-agent@acme.example",
    )
    ticket_agent = await _create_member(
        client,
        auth_headers,
        email="ticket-agent@acme.example",
        first_name="Noah",
        last_name="Diaz",
    )
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    await _assign_conversation(
        client,
        auth_headers,
        conversation["id"],
        conversation_agent["id"],
    )
    ticket = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    assert ticket["assignee_id"] == conversation_agent["id"]

    reassigned = await client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
        json={"assignee_id": ticket_agent["id"]},
    )
    assert reassigned.status_code == 200
    assert reassigned.json()["assignee_id"] == ticket_agent["id"]
    assert reassigned.json()["conversation_assigned_agent_id"] == conversation_agent["id"]

    stored_conversation = await client.get(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
    )
    assert stored_conversation.json()["assigned_agent_id"] == conversation_agent["id"]


@pytest.mark.asyncio
async def test_resolving_ticket_does_not_change_conversation_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    ticket = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )

    resolved = await client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
        json={
            "status": "RESOLVED",
            "resolution_note": "Refund issued.",
        },
    )
    assert resolved.status_code == 200
    body = resolved.json()
    assert body["status"] == "RESOLVED"
    assert body["resolution_note"] == "Refund issued."
    assert body["resolved_at"] is not None
    assert body["conversation_status"] == "Open"
    assert body["conversation_needs_resolution"] is True

    stored_conversation = await client.get(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
    )
    assert stored_conversation.json()["status"] == "Open"


@pytest.mark.asyncio
async def test_closing_conversation_does_not_change_open_ticket_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    ticket = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )

    closed = await client.patch(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
        json={"status": "Closed"},
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "Closed"

    detail = await client.get(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "OPEN"
    assert body["conversation_status"] == "Closed"
    assert body["conversation_needs_resolution"] is False


@pytest.mark.asyncio
async def test_resolution_mismatch_is_cleared_when_conversation_is_closed(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    ticket = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )
    resolved = await client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
        json={"status": "CLOSED"},
    )
    assert resolved.json()["conversation_needs_resolution"] is True

    await client.patch(
        f"/api/v1/conversations/{conversation['id']}",
        headers=auth_headers,
        json={"status": "AI Resolved"},
    )
    detail = await client.get(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
    )
    assert detail.json()["conversation_status"] == "AI Resolved"
    assert detail.json()["conversation_needs_resolution"] is False
    assert detail.json()["status"] == "CLOSED"


@pytest.mark.asyncio
async def test_reopening_ticket_clears_resolved_at_without_inventing_history(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    ticket = await _create_ticket(client, auth_headers, customer["id"])
    resolved = await client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
        json={"status": "RESOLVED", "resolution_note": "Done."},
    )
    assert resolved.json()["resolved_at"] is not None

    reopened = await client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
        json={"status": "OPEN"},
    )
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "OPEN"
    assert reopened.json()["resolved_at"] is None
    assert reopened.json()["resolution_note"] == "Done."


@pytest.mark.asyncio
async def test_cross_workspace_ticket_and_assignee_isolation(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    member = await _create_member(client, auth_headers)
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=customer["id"],
    )
    await _assign_conversation(
        client,
        auth_headers,
        conversation["id"],
        member["id"],
    )
    ticket = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        conversation_id=conversation["id"],
    )

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-assign-res-iso@acme.example",
    )
    foreign_ticket_get = await client.get(
        f"/api/v1/tickets/{ticket['id']}",
        headers=other_headers,
    )
    assert foreign_ticket_get.status_code == 404

    foreign_reassign = await client.patch(
        f"/api/v1/tickets/{ticket['id']}",
        headers=other_headers,
        json={"assignee_id": member["id"]},
    )
    assert foreign_reassign.status_code == 404

    other_customer = await _create_customer(
        client,
        other_headers,
        email="other-customer@acme.example",
    )
    stolen_conversation = await client.post(
        "/api/v1/tickets",
        headers=other_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": other_customer["id"],
            "conversation_id": conversation["id"],
        },
    )
    assert stolen_conversation.status_code == 404
    assert stolen_conversation.json()["detail"] == "Conversation not found."


@pytest.mark.asyncio
async def test_legacy_ticket_without_resolution_fields_remains_readable(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    customer = await _create_customer(client, auth_headers)
    document = build_ticket_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        customer_id=customer["id"],
        title="Legacy ticket",
        description="Created before resolution metadata existed.",
    )
    assert "resolved_at" not in document
    assert "resolution_note" not in document
    await mongodb_module.get_database().tickets.insert_one(document)

    detail = await client.get(
        f"/api/v1/tickets/{document['_id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["resolved_at"] is None
    assert body["resolution_note"] is None
    assert body["conversation_needs_resolution"] is None
    assert body["title"] == "Legacy ticket"
