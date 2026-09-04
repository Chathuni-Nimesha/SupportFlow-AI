"""Workspace-safe conversation.customer_id relationship tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.conversation import build_conversation_document


SAMPLE_CUSTOMER = {
    "first_name": "Elena",
    "last_name": "Park",
    "email": "elena@acme.example",
}

SAMPLE_CONVERSATION = {
    "customer_name": "Elena Park",
    "customer_email": "elena@acme.example",
    "subject": "Duplicate March charge",
    "channel": "Chat",
    "status": "Open",
    "initial_message": "I was charged twice for March — can you refund one?",
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


@pytest.mark.asyncio
async def test_existing_conversation_without_customer_id_remains_readable(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    document = build_conversation_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        customer_name="Legacy Customer",
        customer_email="legacy@acme.example",
        subject="Seeded without customer_id",
        channel="Email",
    )
    assert "customer_id" not in document
    await mongodb_module.get_database().conversations.insert_one(document)

    detail = await client.get(
        f"/api/v1/conversations/{document['_id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == document["_id"]
    assert body["customer_id"] is None
    assert body["customer_name"] == "Legacy Customer"
    assert body["customer_email"] == "legacy@acme.example"
    assert body["owner_id"] == me["id"]
    assert body["workspace_id"] == me["default_workspace_id"]


@pytest.mark.asyncio
async def test_create_conversation_with_same_workspace_customer_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            **SAMPLE_CONVERSATION,
            "customer_id": customer["id"],
            "customer_name": "Display Snapshot",
            "customer_email": "snapshot@acme.example",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["customer_id"] == customer["id"]
    assert body["customer_name"] == "Display Snapshot"
    assert body["customer_email"] == "snapshot@acme.example"


@pytest.mark.asyncio
async def test_create_with_unknown_email_leaves_customer_id_unset(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    assert created.status_code == 201
    assert created.json()["customer_id"] is None
    stored = await mongodb_module.get_database().conversations.find_one(
        {"_id": created.json()["id"]},
    )
    assert stored is not None
    assert "customer_id" not in stored or stored.get("customer_id") in (None, "")


@pytest.mark.asyncio
async def test_same_email_in_two_workspaces_links_only_current_workspace_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    local = await _create_customer(client, auth_headers)
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-link-email@acme.example",
    )
    foreign = await _create_customer(client, other_headers)
    assert foreign["email"] == local["email"]
    assert foreign["id"] != local["id"]

    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json=SAMPLE_CONVERSATION,
    )
    assert created.status_code == 201
    assert created.json()["customer_id"] == local["id"]
    assert created.json()["customer_id"] != foreign["id"]


@pytest.mark.asyncio
async def test_create_ignores_client_workspace_and_owner_when_linking_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    me = await _me(client, auth_headers)
    customer = await _create_customer(client, auth_headers)
    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "forge-link@acme.example",
    )
    other = await _me(client, other_headers)

    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            **SAMPLE_CONVERSATION,
            "customer_id": customer["id"],
            "workspace_id": other["default_workspace_id"],
            "owner_id": other["id"],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["customer_id"] == customer["id"]
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]
    assert body["workspace_id"] != other["default_workspace_id"]
    assert body["owner_id"] != other["id"]


@pytest.mark.asyncio
async def test_update_conversation_with_same_workspace_customer_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            **SAMPLE_CONVERSATION,
            "customer_email": "unlinked@acme.example",
        },
    )
    assert created.status_code == 201
    assert created.json()["customer_id"] is None

    updated = await client.patch(
        f"/api/v1/conversations/{created.json()['id']}",
        headers=auth_headers,
        json={"customer_id": customer["id"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["customer_id"] == customer["id"]
    assert updated.json()["customer_email"] == "unlinked@acme.example"
    assert updated.json()["customer_name"] == "Elena Park"

    cleared = await client.patch(
        f"/api/v1/conversations/{created.json()['id']}",
        headers=auth_headers,
        json={"customer_id": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["customer_id"] is None
    stored = await mongodb_module.get_database().conversations.find_one(
        {"_id": created.json()["id"]},
    )
    assert stored is not None
    assert stored.get("customer_id") in (None, "")
    assert "customer_id" not in stored or stored.get("customer_id") in (None, "")


@pytest.mark.asyncio
async def test_update_foreign_customer_id_does_not_modify_conversation(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "customer_id": customer["id"]},
    )
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-update-link@acme.example",
    )
    foreign = await _create_customer(
        client,
        other_headers,
        email="foreign-update@acme.example",
    )

    patched = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
        json={"customer_id": foreign["id"], "status": "Closed"},
    )
    assert patched.status_code == 404
    assert patched.json()["detail"] == "Customer not found."

    detail = await client.get(
        f"/api/v1/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["customer_id"] == customer["id"]
    assert body["status"] == "Open"


@pytest.mark.asyncio
async def test_customer_detail_returns_linked_conversations_by_customer_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={
            **SAMPLE_CONVERSATION,
            "customer_id": customer["id"],
            "customer_email": "different-snapshot@acme.example",
            "subject": "Linked by id",
        },
    )
    assert created.status_code == 201

    detail = await client.get(
        f"/api/v1/customers/{customer['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    conversations = detail.json()["conversations"]
    assert len(conversations) == 1
    assert conversations[0]["id"] == created.json()["id"]
    assert conversations[0]["customer_id"] == customer["id"]


@pytest.mark.asyncio
async def test_customer_email_change_does_not_break_linked_relationship(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "customer_id": customer["id"]},
    )
    assert created.status_code == 201

    renamed = await client.patch(
        f"/api/v1/customers/{customer['id']}",
        headers=auth_headers,
        json={"email": "elena.renamed@acme.example"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["email"] == "elena.renamed@acme.example"

    thread = await client.get(
        f"/api/v1/conversations/{created.json()['id']}",
        headers=auth_headers,
    )
    assert thread.json()["customer_email"] == "elena@acme.example"
    assert thread.json()["customer_id"] == customer["id"]

    detail = await client.get(
        f"/api/v1/customers/{customer['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    ids = [item["id"] for item in detail.json()["conversations"]]
    assert created.json()["id"] in ids


@pytest.mark.asyncio
async def test_legacy_conversation_appears_through_email_fallback(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    customer = await _create_customer(client, auth_headers)
    me = await _me(client, auth_headers)
    document = build_conversation_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        customer_name="Elena Park",
        customer_email="elena@acme.example",
        subject="Legacy email match",
        channel="Email",
    )
    assert "customer_id" not in document
    await mongodb_module.get_database().conversations.insert_one(document)

    detail = await client.get(
        f"/api/v1/customers/{customer['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    subjects = [item["subject"] for item in detail.json()["conversations"]]
    assert "Legacy email match" in subjects


@pytest.mark.asyncio
async def test_foreign_workspace_customer_cannot_see_related_conversations(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await _create_customer(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "customer_id": customer["id"]},
    )
    assert created.status_code == 201

    other_headers = await _other_headers(
        client,
        sample_register_payload,
        "other-related@acme.example",
    )
    foreign_customer = await _create_customer(client, other_headers)

    leaked = await client.get(
        f"/api/v1/customers/{customer['id']}",
        headers=other_headers,
    )
    assert leaked.status_code == 404

    foreign_detail = await client.get(
        f"/api/v1/customers/{foreign_customer['id']}",
        headers=other_headers,
    )
    assert foreign_detail.status_code == 200
    assert foreign_detail.json()["conversations"] == []


@pytest.mark.asyncio
async def test_linked_conversation_does_not_appear_on_other_same_workspace_customer(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    linked = await _create_customer(client, auth_headers)
    other = await _create_customer(
        client,
        auth_headers,
        email="other-local@acme.example",
        first_name="Other",
    )
    me = await _me(client, auth_headers)
    document = build_conversation_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        customer_id=linked["id"],
        customer_name="Other Local",
        customer_email=other["email"],
        subject="Belongs to linked customer",
        channel="Email",
    )
    await mongodb_module.get_database().conversations.insert_one(document)

    other_detail = await client.get(
        f"/api/v1/customers/{other['id']}",
        headers=auth_headers,
    )
    assert other_detail.status_code == 200
    other_ids = [item["id"] for item in other_detail.json()["conversations"]]
    assert document["_id"] not in other_ids

    linked_detail = await client.get(
        f"/api/v1/customers/{linked['id']}",
        headers=auth_headers,
    )
    assert linked_detail.status_code == 200
    linked_ids = [item["id"] for item in linked_detail.json()["conversations"]]
    assert document["_id"] in linked_ids


@pytest.mark.asyncio
async def test_update_ignores_client_workspace_id_when_setting_customer_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    customer = await _create_customer(client, auth_headers)
    created = await client.post(
        "/api/v1/conversations",
        headers=auth_headers,
        json={**SAMPLE_CONVERSATION, "customer_email": "plain@acme.example"},
    )
    updated = await client.patch(
        f"/api/v1/conversations/{created.json()['id']}",
        headers=auth_headers,
        json={
            "customer_id": customer["id"],
            "workspace_id": me["id"],
            "owner_id": "forged-owner",
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["customer_id"] == customer["id"]
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]
