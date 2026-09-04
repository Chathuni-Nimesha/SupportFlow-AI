"""Customer directory API tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.customer import build_customer_document
from app.models.team_member import build_team_member_document


SAMPLE_CUSTOMER = {
    "first_name": "Elena",
    "last_name": "Park",
    "email": "elena@acme.example",
    "phone": "+1-555-0100",
    "company": "Harbor Retail",
    "notes": "Prefers email follow-up.",
}


async def _other_headers(
    client: AsyncClient,
    sample_register_payload: dict,
    email: str = "other-customers@acme.example",
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


async def _me(client: AsyncClient, headers: dict[str, str]) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


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
    me = await _me(client, auth_headers)
    assert body["first_name"] == "Elena"
    assert body["last_name"] == "Park"
    assert body["email"] == "elena@acme.example"
    assert body["phone"] == "+1-555-0100"
    assert body["company"] == "Harbor Retail"
    assert body["notes"] == "Prefers email follow-up."
    assert "id" in body
    assert body["owner_id"] == me["id"]
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["workspace_id"] != me["id"]
    assert "created_at" in body
    assert "updated_at" in body
    assert "password" not in body
    assert "password_hash" not in body


@pytest.mark.asyncio
async def test_create_customer_ignores_client_workspace_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    response = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={**SAMPLE_CUSTOMER, "workspace_id": me["id"]},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["workspace_id"] != me["id"]
    assert body["owner_id"] == me["id"]


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
async def test_same_customer_email_allowed_in_different_workspaces(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    first = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert first.status_code == 201

    other_headers = await _other_headers(client, sample_register_payload)
    second = await client.post(
        "/api/v1/customers",
        headers=other_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert second.status_code == 201
    assert second.json()["email"] == first.json()["email"]
    assert second.json()["workspace_id"] != first.json()["workspace_id"]
    assert second.json()["id"] != first.json()["id"]


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
    assert len(listed.json()["items"]) == 2
    assert listed.json()["total"] == 2
    assert listed.json()["has_next"] is False

    searched = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"q": "harbor"},
    )
    assert searched.status_code == 200
    items = searched.json()["items"]
    assert len(items) == 1
    assert items[0]["email"] == "elena@acme.example"

    by_full_name = await client.get(
        "/api/v1/customers",
        headers=auth_headers,
        params={"q": "Elena Park"},
    )
    assert by_full_name.status_code == 200
    assert len(by_full_name.json()["items"]) == 1
    assert by_full_name.json()["items"][0]["email"] == "elena@acme.example"


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
async def test_customer_related_conversations_stay_in_current_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    owner_payload = {**sample_register_payload, "email": "cust-owner@acme.example"}
    other_payload = {**sample_register_payload, "email": "cust-other@acme.example"}
    await client.post("/api/v1/auth/register", json=owner_payload)
    other = (await client.post("/api/v1/auth/register", json=other_payload)).json()
    owner_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": owner_payload["email"],
            "password": owner_payload["password"],
        },
    )
    other_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": other_payload["email"],
            "password": other_payload["password"],
        },
    )
    owner_headers = {
        "Authorization": f"Bearer {owner_login.json()['access_token']}",
    }
    other_headers = {
        "Authorization": f"Bearer {other_login.json()['access_token']}",
    }
    owner = await _me(client, owner_headers)

    owner_customer = await client.post(
        "/api/v1/customers",
        headers=owner_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert owner_customer.status_code == 201
    await client.post(
        "/api/v1/conversations",
        headers=owner_headers,
        json={
            "customer_name": "Elena Park",
            "customer_email": SAMPLE_CUSTOMER["email"],
            "subject": "Owner workspace refund",
            "channel": "Email",
        },
    )

    other_customer = await client.post(
        "/api/v1/customers",
        headers=other_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert other_customer.status_code == 201
    await client.post(
        "/api/v1/conversations",
        headers=other_headers,
        json={
            "customer_name": "Elena Park",
            "customer_email": SAMPLE_CUSTOMER["email"],
            "subject": "Other workspace refund",
            "channel": "Email",
        },
    )

    member = build_team_member_document(
        owner_id=other["id"],
        user_id=owner["id"],
        first_name=owner["first_name"],
        last_name=owner["last_name"],
        email=owner["email"],
        role="AGENT",
        status="ACTIVE",
        workspace_id=other["default_workspace_id"],
    )
    await mongodb_module._database.team_members.insert_one(member)
    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=owner_headers,
    )
    assert selected.status_code == 200, selected.text

    detail = await client.get(
        f"/api/v1/customers/{other_customer.json()['id']}",
        headers=owner_headers,
    )
    assert detail.status_code == 200
    subjects = [item["subject"] for item in detail.json()["conversations"]]
    assert subjects == ["Other workspace refund"]
    assert "Owner workspace refund" not in subjects


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
    me = await _me(client, auth_headers)

    updated = await client.patch(
        f"/api/v1/customers/{customer_id}",
        headers=auth_headers,
        json={
            "phone": "+1-555-0199",
            "notes": "VIP",
            "workspace_id": me["id"],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["phone"] == "+1-555-0199"
    assert body["notes"] == "VIP"
    assert body["email"] == SAMPLE_CUSTOMER["email"]
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]


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
async def test_customers_are_scoped_to_workspace(
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
    owner = await _me(client, auth_headers)
    other_headers = await _other_headers(client, sample_register_payload)
    other = await _me(client, other_headers)

    assert owner["default_workspace_id"] != other["default_workspace_id"]

    listed = await client.get("/api/v1/customers", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    assert listed.json()["total"] == 0

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

    still_there = await client.get(
        f"/api/v1/customers/{customer_id}",
        headers=auth_headers,
    )
    assert still_there.status_code == 200
    assert still_there.json()["workspace_id"] == owner["default_workspace_id"]


@pytest.mark.asyncio
async def test_backfilled_customer_is_accessible_in_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    document = build_customer_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        first_name="Backfilled",
        last_name="Customer",
        email="backfilled@acme.example",
    )
    db = mongodb_module.get_database()
    await db.customers.insert_one(document)

    listed = await client.get("/api/v1/customers", headers=auth_headers)
    assert listed.status_code == 200
    emails = [item["email"] for item in listed.json()["items"]]
    assert "backfilled@acme.example" in emails

    detail = await client.get(
        f"/api/v1/customers/{document['_id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["workspace_id"] == me["default_workspace_id"]
    assert detail.json()["owner_id"] == me["id"]
