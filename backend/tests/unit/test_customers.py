"""Customer directory API tests."""

import pytest
from httpx import AsyncClient


SAMPLE_CUSTOMER = {
    "first_name": "Elena",
    "last_name": "Park",
    "email": "elena@acme.example",
    "phone": "+1-555-0100",
    "company": "Harbor Retail",
    "notes": "Prefers email follow-up.",
}


@pytest.mark.asyncio
async def test_list_customers_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/customers")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["first_name"] == "Elena"
    assert body["last_name"] == "Park"
    assert body["email"] == "elena@acme.example"
    assert body["phone"] == "+1-555-0100"
    assert body["company"] == "Harbor Retail"
    assert body["notes"] == "Prefers email follow-up."
    assert "id" in body
    assert "owner_id" in body
    assert "created_at" in body
    assert "updated_at" in body
    assert "password" not in body
    assert "password_hash" not in body


@pytest.mark.asyncio
async def test_create_customer_rejects_invalid_email(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={**SAMPLE_CUSTOMER, "email": "not-an-email"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_customer_requires_name(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={**SAMPLE_CUSTOMER, "first_name": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_customer_rejects_duplicate_email(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    first = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert first.status_code == 201

    duplicate = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={**SAMPLE_CUSTOMER, "first_name": "Other"},
    )
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_list_and_search_customers(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert created.status_code == 201
    await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={
            "first_name": "Noah",
            "last_name": "Diaz",
            "email": "noah@orbit.example",
            "company": "Orbitly",
        },
    )

    listed = await client.get("/api/v1/customers", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    searched = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"q": "harbor"},
    )
    assert searched.status_code == 200
    items = searched.json()
    assert len(items) == 1
    assert items[0]["email"] == "elena@acme.example"

    by_full_name = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"q": "Elena Park"},
    )
    assert by_full_name.status_code == 200
    assert len(by_full_name.json()) == 1
    assert by_full_name.json()[0]["email"] == "elena@acme.example"


@pytest.mark.asyncio
async def test_get_customer_includes_related_conversations(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    customer_id = created.json()["id"]

    conversation = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            "customer_name": "Elena Park",
            "customer_email": "elena@acme.example",
            "subject": "Refund window",
            "channel": "Email",
            "initial_message": "What is your refund policy?",
        },
    )
    assert conversation.status_code == 201

    detail = await client.get(
        f"/api/v1/customers/{customer_id}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == customer_id
    assert len(body["conversations"]) == 1
    assert body["conversations"][0]["subject"] == "Refund window"


@pytest.mark.asyncio
async def test_update_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    customer_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/customers/{customer_id}",
        headers=auth_headers,
        json={"phone": "+1-555-0199", "notes": "VIP"},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["phone"] == "+1-555-0199"
    assert body["notes"] == "VIP"
    assert body["email"] == SAMPLE_CUSTOMER["email"]


@pytest.mark.asyncio
async def test_delete_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    customer_id = created.json()["id"]

    deleted = await client.delete(
        f"/api/v1/customers/{customer_id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204

    missing = await client.get(
        f"/api/v1/customers/{customer_id}",
        headers=auth_headers,
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_get_customer_not_found(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/customers/does-not-exist",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_customers_are_scoped_to_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    customer_id = created.json()["id"]

    other_payload = {
        **sample_register_payload,
        "email": "other-customers@acme.example",
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

    listed = await client.get("/api/v1/customers", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json() == []

    detail = await client.get(
        f"/api/v1/customers/{customer_id}",
        headers=other_headers,
    )
    assert detail.status_code == 404

    patched = await client.patch(
        f"/api/v1/customers/{customer_id}",
        headers=other_headers,
        json={"notes": "should not work"},
    )
    assert patched.status_code == 404

    deleted = await client.delete(
        f"/api/v1/customers/{customer_id}",
        headers=other_headers,
    )
    assert deleted.status_code == 404
