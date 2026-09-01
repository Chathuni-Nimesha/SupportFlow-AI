"""Ticket management API tests."""

import pytest
from httpx import AsyncClient


SAMPLE_CUSTOMER = {
    "first_name": "Elena",
    "last_name": "Park",
    "email": "elena@acme.example",
    "phone": "+1-555-0100",
    "company": "Harbor Retail",
}

SAMPLE_TICKET = {
    "title": "Refund not received",
    "description": "Customer paid twice and needs the duplicate charge reversed.",
    "status": "OPEN",
    "priority": "HIGH",
}


async def _create_customer(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides,
) -> dict:
    payload = {**SAMPLE_CUSTOMER, **overrides}
    response = await client.post(
        "/api/v1/customers",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
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


@pytest.mark.asyncio
async def test_list_tickets_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/tickets")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_ticket_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/v1/tickets", json=SAMPLE_TICKET)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={**SAMPLE_TICKET, "customer_id": customer["id"]},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == SAMPLE_TICKET["title"]
    assert body["description"] == SAMPLE_TICKET["description"]
    assert body["status"] == "OPEN"
    assert body["priority"] == "HIGH"
    assert body["customer_id"] == customer["id"]
    assert body["assignee_id"] is None
    assert body["customer"]["email"] == "elena@acme.example"
    assert body["customer"]["first_name"] == "Elena"
    assert "id" in body
    assert "owner_id" in body
    assert "created_at" in body
    assert "updated_at" in body
    assert "password" not in body
    assert "password_hash" not in body


@pytest.mark.asyncio
async def test_create_ticket_rejects_unknown_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={**SAMPLE_TICKET, "customer_id": "missing-customer"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found."


@pytest.mark.asyncio
async def test_create_ticket_rejects_invalid_status(
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
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_ticket_rejects_invalid_priority(
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
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_ticket_requires_title(
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
            "title": "   ",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_ticket_rejects_unknown_assignee(
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
            "assignee_id": "someone-else",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."


@pytest.mark.asyncio
async def test_create_ticket_can_assign_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    me = await _current_user(client, auth_headers)
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        assignee_id=me["id"],
    )
    assert created["assignee_id"] == me["id"]
    assert created["assignee"]["id"] == me["id"]
    assert created["assignee"]["role"] == "OWNER"
    assert created["assignee"]["email"] == me["email"]


@pytest.mark.asyncio
async def test_list_search_and_filter_tickets(
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
    me = await _current_user(client, auth_headers)

    refund = await _create_ticket(client, auth_headers, customer["id"])
    shipping = await _create_ticket(
        client,
        auth_headers,
        other["id"],
        title="Late shipment",
        description="Package has not arrived after five days.",
        status="IN_PROGRESS",
        priority="LOW",
        assignee_id=me["id"],
    )

    listed = await client.get("/api/v1/tickets", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    searched = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"q": "duplicate charge"},
    )
    assert searched.status_code == 200
    assert len(searched.json()) == 1
    assert searched.json()[0]["id"] == refund["id"]

    by_status = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"status": "IN_PROGRESS"},
    )
    assert by_status.status_code == 200
    assert [item["id"] for item in by_status.json()] == [shipping["id"]]

    by_priority = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"priority": "HIGH"},
    )
    assert by_priority.status_code == 200
    assert [item["id"] for item in by_priority.json()] == [refund["id"]]

    by_assignee = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"assignee_id": me["id"]},
    )
    assert by_assignee.status_code == 200
    assert [item["id"] for item in by_assignee.json()] == [shipping["id"]]

    unassigned = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"unassigned": True},
    )
    assert unassigned.status_code == 200
    assert [item["id"] for item in unassigned.json()] == [refund["id"]]

    by_customer = await client.get(
        "/api/v1/tickets",
        headers=auth_headers,
        params={"customer_id": customer["id"]},
    )
    assert by_customer.status_code == 200
    assert [item["id"] for item in by_customer.json()] == [refund["id"]]


@pytest.mark.asyncio
async def test_get_ticket_detail(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])

    detail = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == created["id"]
    assert body["customer"]["email"] == "elena@acme.example"
    assert body["title"] == SAMPLE_TICKET["title"]


@pytest.mark.asyncio
async def test_update_ticket_status_and_priority(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])

    updated = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"status": "RESOLVED", "priority": "LOW"},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["status"] == "RESOLVED"
    assert body["priority"] == "LOW"
    assert body["title"] == SAMPLE_TICKET["title"]


@pytest.mark.asyncio
async def test_update_ticket_rejects_empty_body(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    response = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_delete_ticket(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])

    deleted = await client.delete(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204

    missing = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_get_ticket_not_found(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/tickets/does-not-exist",
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Ticket not found."


@pytest.mark.asyncio
async def test_tickets_are_scoped_to_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await _create_ticket(client, auth_headers, customer["id"])
    ticket_id = created["id"]

    other_payload = {
        **sample_register_payload,
        "email": "other-tickets@acme.example",
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

    listed = await client.get("/api/v1/tickets", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json() == []

    detail = await client.get(
        f"/api/v1/tickets/{ticket_id}",
        headers=other_headers,
    )
    assert detail.status_code == 404

    patched = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=other_headers,
        json={"status": "CLOSED"},
    )
    assert patched.status_code == 404

    deleted = await client.delete(
        f"/api/v1/tickets/{ticket_id}",
        headers=other_headers,
    )
    assert deleted.status_code == 404

    stolen_customer = await client.post(
        "/api/v1/tickets",
        headers=other_headers,
        json={**SAMPLE_TICKET, "customer_id": customer["id"]},
    )
    assert stolen_customer.status_code == 404
    assert stolen_customer.json()["detail"] == "Customer not found."


@pytest.mark.asyncio
async def test_assign_ticket_to_team_member(
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
    assert created["assignee"]["first_name"] == "Sarah"
    assert created["assignee"]["last_name"] == "Perera"
    assert created["assignee"]["role"] == "AGENT"

    detail = await client.get(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["assignee"]["email"] == "sarah@acme.example"


@pytest.mark.asyncio
async def test_update_ticket_assignment_and_unassign(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    agent = await _create_member(client, auth_headers)
    admin = await _create_member(
        client,
        auth_headers,
        first_name="John",
        last_name="Silva",
        email="john@acme.example",
        role="ADMIN",
    )
    created = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        assignee_id=agent["id"],
    )

    reassigned = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"assignee_id": admin["id"]},
    )
    assert reassigned.status_code == 200
    assert reassigned.json()["assignee_id"] == admin["id"]
    assert reassigned.json()["assignee"]["first_name"] == "John"

    unassigned = await client.patch(
        f"/api/v1/tickets/{created['id']}",
        headers=auth_headers,
        json={"assignee_id": None},
    )
    assert unassigned.status_code == 200
    assert unassigned.json()["assignee_id"] is None
    assert unassigned.json()["assignee"] is None


@pytest.mark.asyncio
async def test_assign_ticket_rejects_foreign_team_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)

    other_payload = {
        **sample_register_payload,
        "email": "other-assignee@acme.example",
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
    foreign = await _create_member(
        client,
        other_headers,
        email="foreign-agent@acme.example",
    )

    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "assignee_id": foreign["id"],
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."


@pytest.mark.asyncio
async def test_assign_ticket_rejects_disabled_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    member = await _create_member(client, auth_headers)
    disabled = await client.patch(
        f"/api/v1/team/{member['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 200

    response = await client.post(
        "/api/v1/tickets",
        headers=auth_headers,
        json={
            **SAMPLE_TICKET,
            "customer_id": customer["id"],
            "assignee_id": member["id"],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Assignee is not an active team member."


@pytest.mark.asyncio
async def test_delete_team_member_unassigns_tickets(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    member = await _create_member(client, auth_headers)
    ticket = await _create_ticket(
        client,
        auth_headers,
        customer["id"],
        assignee_id=member["id"],
    )

    deleted = await client.delete(
        f"/api/v1/team/{member['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204

    detail = await client.get(
        f"/api/v1/tickets/{ticket['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["assignee_id"] is None
    assert detail.json()["assignee"] is None
