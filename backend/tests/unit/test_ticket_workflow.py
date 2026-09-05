"""Ticket workflow hardening: status, priority, assignment, atomic PATCH."""

import pytest
from httpx import AsyncClient

from app.models.ticket import TICKET_PRIORITIES, TICKET_STATUSES
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


async def _snapshot(
    client: AsyncClient,
    headers: dict[str, str],
    ticket_id: str,
) -> dict:
    response = await client.get(f"/api/v1/tickets/{ticket_id}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    return {
        "status": body["status"],
        "priority": body["priority"],
        "title": body["title"],
        "customer_id": body["customer_id"],
        "assignee_id": body["assignee_id"],
        "conversation_id": body["conversation_id"],
    }


def _assert_invalid_choice(response, phrase: str) -> None:
    assert response.status_code == 422
    assert phrase in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize("ticket_status", TICKET_STATUSES)
async def test_create_accepts_each_valid_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
    ticket_status: str,
) -> None:
    customer = await _create_customer(
        client,
        auth_headers,
        email=f"{ticket_status.lower()}@acme.example",
    )
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        status=ticket_status,
        title=f"{ticket_status} ticket",
    )
    assert created["status"] == ticket_status


@pytest.mark.asyncio
@pytest.mark.parametrize("priority", TICKET_PRIORITIES)
async def test_create_accepts_each_valid_priority(
    client: AsyncClient,
    auth_headers: dict[str, str],
    priority: str,
) -> None:
    customer = await _create_customer(
        client,
        auth_headers,
        email=f"{priority.lower()}@acme.example",
    )
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        priority=priority,
        title=f"{priority} ticket",
    )
    assert created["priority"] == priority


@pytest.mark.asyncio
async def test_update_accepts_valid_status_and_priority(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])

    updated = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"status": "IN_PROGRESS", "priority": "URGENT"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "IN_PROGRESS"
    assert updated.json()["priority"] == "URGENT"
    assert updated.json()["title"] == SAMPLE_TICKET["title"]


@pytest.mark.asyncio
async def test_create_rejects_invalid_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "status": "DONE",
        },
    )
    _assert_invalid_choice(response, "Invalid status")


@pytest.mark.asyncio
async def test_create_rejects_invalid_priority(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "priority": "CRITICAL",
        },
    )
    _assert_invalid_choice(response, "Invalid priority")


@pytest.mark.asyncio
async def test_update_rejects_invalid_status_and_leaves_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    before = await _snapshot(client, auth_headers, created["id"])

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"status": "DONE", "priority": "LOW"},
    )
    _assert_invalid_choice(response, "Invalid status")
    assert await _snapshot(client, auth_headers, created["id"]) == before


@pytest.mark.asyncio
async def test_update_rejects_invalid_priority_and_leaves_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    before = await _snapshot(client, auth_headers, created["id"])

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"priority": "CRITICAL", "status": "CLOSED"},
    )
    _assert_invalid_choice(response, "Invalid priority")
    assert await _snapshot(client, auth_headers, created["id"]) == before


@pytest.mark.asyncio
async def test_update_rejects_foreign_assignee_and_leaves_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    local_member = await _create_member(client, auth_headers)
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        assignee_id=local_member["id"],
    )
    before = await _snapshot(client, auth_headers, created["id"])

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-workflow-assignee@acme.example",
    )
    foreign = await _create_member(
        client,
        other_headers,
        email="foreign-workflow-agent@acme.example",
    )

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"assignee_id": foreign["id"], "status": "CLOSED"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."
    assert await _snapshot(client, auth_headers, created["id"]) == before


@pytest.mark.asyncio
async def test_update_rejects_inactive_assignee_and_leaves_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    member = await _create_member(client, auth_headers)
    disabled = await client.patch(
        f"/api/v1/team/{member['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 200
    before = await _snapshot(client, auth_headers, created["id"])

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"assignee_id": member["id"], "status": "CLOSED"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Assignee is not an active team member."
    assert await _snapshot(client, auth_headers, created["id"]) == before


@pytest.mark.asyncio
async def test_multifield_invalid_customer_leaves_ticket_unchanged(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    before = await _snapshot(client, auth_headers, created["id"])

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-workflow-customer@acme.example",
    )
    foreign = await _create_customer(
        client,
        other_headers,
        email="foreign-workflow-customer@acme.example",
    )

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={
            "status": "CLOSED",
            "priority": "LOW",
            "title": "Should not persist",
            "customer_id": foreign["id"],
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found."
    assert await _snapshot(client, auth_headers, created["id"]) == before


@pytest.mark.asyncio
async def test_multifield_conversation_mismatch_leaves_ticket_unchanged(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    other = await _create_customer(
        client,
        auth_headers,
        email="noah@orbit.example",
        first_name="Noah",
        last_name="Diaz",
    )
    conversation = await _create_conversation(
        client,
        auth_headers,
        customer_id=other["id"],
    )
    created = await _create_ticket(client, auth_headers, customer["id"])
    before = await _snapshot(client, auth_headers, created["id"])

    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={
            "status": "CLOSED",
            "conversation_id": conversation["id"],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == TICKET_CONVERSATION_CUSTOMER_MISMATCH
    assert await _snapshot(client, auth_headers, created["id"]) == before


@pytest.mark.asyncio
async def test_status_filter_stays_workspace_scoped(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    local = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        status="PENDING",
        title="Local pending ticket",
    )

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-workflow-list@acme.example",
    )
    other_customer = await _create_customer(
        client,
        other_headers,
        email="other-pending@acme.example",
    )
    foreign = await _create_ticket(
        client,
        other_headers,
        other_customer["id"],
        status="PENDING",
        title="Foreign pending ticket",
    )

    listed = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"status": "PENDING"},
    )
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["items"]]
    assert local["id"] in ids
    assert foreign["id"] not in ids

    invalid = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"status": "DONE"},
    )
    _assert_invalid_choice(invalid, "Invalid status")


@pytest.mark.asyncio
async def test_unassign_remains_supported(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    member = await _create_member(client, auth_headers)
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        assignee_id=member["id"],
    )
    assert created["assignee_id"] == member["id"]

    unassigned = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"assignee_id": None},
    )
    assert unassigned.status_code == 200
    assert unassigned.json()["assignee_id"] is None
    assert unassigned.json()["assignee"] is None
