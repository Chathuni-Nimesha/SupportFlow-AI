"""Phase 1I: workspace_id is the tenant boundary; owner_id is not."""

import pytest
from httpx import AsyncClient

from app.core.security import decode_access_token
from app.database import mongodb as mongodb_module
from app.database.chroma import reset_chroma_client
from app.models.conversation import build_conversation_document
from app.models.customer import build_customer_document
from app.models.knowledge import build_knowledge_document
from app.models.message import build_message_document
from app.models.team_member import build_team_member_document
from app.models.ticket import build_ticket_document
from app.services.knowledge_ingestion import ingest_knowledge_document
from app.services.knowledge_retrieval import retrieve_knowledge


async def _me(client: AsyncClient, headers: dict[str, str]) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


async def _register_and_login(
    client: AsyncClient,
    payload: dict,
) -> tuple[dict, dict[str, str]]:
    registered = await client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code == 201, registered.text
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return registered.json(), headers


async def _add_admin_membership(*, owner_id: str, user: dict, workspace_id: str) -> None:
    member = build_team_member_document(
        owner_id=owner_id,
        user_id=user["id"],
        first_name=user["first_name"],
        last_name=user["last_name"],
        email=user["email"],
        role="ADMIN",
        status="ACTIVE",
        workspace_id=workspace_id,
    )
    await mongodb_module._database.team_members.insert_one(member)


def _ids(payload: dict) -> set[str]:
    return {item["id"] for item in payload.get("items", [])}


@pytest.mark.asyncio
async def test_jwt_still_has_no_workspace_claim(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    _, headers = await _register_and_login(client, sample_register_payload)
    token = headers["Authorization"].removeprefix("Bearer ")
    payload = decode_access_token(token)
    assert payload["type"] == "access"
    assert "workspace_id" not in payload
    assert "owner_id" not in payload
    assert "role" not in payload


@pytest.mark.asyncio
async def test_customers_isolate_by_workspace_id_not_owner_id(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user, headers = await _register_and_login(client, sample_register_payload)
    me = await _me(client, headers)
    workspace_id = me["default_workspace_id"]
    foreign = build_customer_document(
        owner_id="not-the-current-user",
        workspace_id=workspace_id,
        first_name="Foreign",
        last_name="Owner",
        email="foreign-owner@acme.example",
    )
    leaked = build_customer_document(
        owner_id=user["id"],
        workspace_id="workspace-other",
        first_name="Leaked",
        last_name="Owner",
        email="leaked-owner@acme.example",
    )
    db = mongodb_module.get_database()
    await db.customers.insert_one(foreign)
    await db.customers.insert_one(leaked)

    listed = await client.get("/api/v1/customers", headers=headers)
    assert listed.status_code == 200
    ids = _ids(listed.json())
    assert foreign["_id"] in ids
    assert leaked["_id"] not in ids

    spoofed = await client.get(
        "/api/v1/customers",
        headers=headers,
        params={"workspace_id": "workspace-other"},
    )
    assert spoofed.status_code == 200
    assert leaked["_id"] not in _ids(spoofed.json())


@pytest.mark.asyncio
async def test_same_user_can_reuse_customer_email_in_another_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user, headers = await _register_and_login(
        client,
        {**sample_register_payload, "email": "same-email-owner@acme.example"},
    )
    other, _ = await _register_and_login(
        client,
        {**sample_register_payload, "email": "same-email-host@acme.example"},
    )
    await _add_admin_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
    )
    payload = {
        "first_name": "Elena",
        "last_name": "Park",
        "email": "shared-customer@acme.example",
    }
    first = await client.post("/api/v1/customers", headers=headers, json=payload)
    assert first.status_code == 201, first.text

    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    second = await client.post("/api/v1/customers", headers=headers, json=payload)
    assert second.status_code == 201, second.text
    assert second.json()["email"] == first.json()["email"]
    assert second.json()["workspace_id"] != first.json()["workspace_id"]
    assert second.json()["owner_id"] == user["id"]

    duplicate = await client.post("/api/v1/customers", headers=headers, json=payload)
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_tickets_isolate_by_workspace_id_not_owner_id(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user, headers = await _register_and_login(client, sample_register_payload)
    me = await _me(client, headers)
    workspace_id = me["default_workspace_id"]
    customer = await client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "first_name": "Elena",
            "last_name": "Park",
            "email": "ticket-owner@acme.example",
        },
    )
    assert customer.status_code == 201
    foreign = build_ticket_document(
        owner_id="not-the-current-user",
        workspace_id=workspace_id,
        customer_id=customer.json()["id"],
        title="Foreign owner ticket",
        description="Visible because workspace matches.",
    )
    leaked = build_ticket_document(
        owner_id=user["id"],
        workspace_id="workspace-other",
        customer_id=customer.json()["id"],
        title="Leaked owner ticket",
        description="Hidden because workspace does not match.",
    )
    db = mongodb_module.get_database()
    await db.tickets.insert_one(foreign)
    await db.tickets.insert_one(leaked)

    listed = await client.get("/api/v1/tickets", headers=headers)
    assert listed.status_code == 200
    ids = _ids(listed.json())
    assert foreign["_id"] in ids
    assert leaked["_id"] not in ids


@pytest.mark.asyncio
async def test_conversations_and_messages_isolate_by_workspace_id_not_owner_id(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user, headers = await _register_and_login(client, sample_register_payload)
    me = await _me(client, headers)
    workspace_id = me["default_workspace_id"]
    foreign = build_conversation_document(
        owner_id="not-the-current-user",
        workspace_id=workspace_id,
        customer_name="Foreign Owner",
        customer_email="foreign-thread@acme.example",
        subject="Workspace conversation",
        channel="Email",
    )
    leaked = build_conversation_document(
        owner_id=user["id"],
        workspace_id="workspace-other",
        customer_name="Leaked Owner",
        customer_email="leaked-thread@acme.example",
        subject="Other workspace conversation",
        channel="Email",
    )
    message = build_message_document(
        conversation_id=foreign["_id"],
        owner_id="not-the-current-user",
        workspace_id=workspace_id,
        sender_type="customer",
        content="Hello from a foreign owner_id",
        sender_name="Foreign Owner",
    )
    db = mongodb_module.get_database()
    await db.conversations.insert_one(foreign)
    await db.conversations.insert_one(leaked)
    await db.messages.insert_one(message)

    listed = await client.get("/api/v1/conversations", headers=headers)
    assert listed.status_code == 200
    ids = _ids(listed.json())
    assert foreign["_id"] in ids
    assert leaked["_id"] not in ids

    messages = await client.get(
        f"/api/v1/conversations/{foreign['_id']}/messages",
        headers=headers,
    )
    assert messages.status_code == 200
    assert messages.json()[0]["content"] == "Hello from a foreign owner_id"

    hidden = await client.get(
        f"/api/v1/conversations/{leaked['_id']}/messages",
        headers=headers,
    )
    assert hidden.status_code == 404


@pytest.mark.asyncio
async def test_knowledge_and_chroma_isolate_by_workspace_id_not_owner_id(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    reset_chroma_client()
    user, headers = await _register_and_login(client, sample_register_payload)
    me = await _me(client, headers)
    workspace_id = me["default_workspace_id"]
    foreign = build_knowledge_document(
        owner_id="not-the-current-user",
        workspace_id=workspace_id,
        title="Foreign owner refund policy",
        content="Refunds are issued within fourteen days when workspace matches.",
        status="Published",
    )
    leaked = build_knowledge_document(
        owner_id=user["id"],
        workspace_id="workspace-other",
        title="Leaked owner refund policy",
        content="This other-workspace article must not be retrieved.",
        status="Published",
    )
    db = mongodb_module.get_database()
    await db.knowledge_documents.insert_one(foreign)
    await db.knowledge_documents.insert_one(leaked)
    ingested = await ingest_knowledge_document(foreign)
    assert ingested["ingestion_status"] == "indexed"
    await ingest_knowledge_document(leaked)

    listed = await client.get("/api/v1/knowledge-documents", headers=headers)
    assert listed.status_code == 200
    ids = _ids(listed.json())
    assert foreign["_id"] in ids
    assert leaked["_id"] not in ids

    hits = await retrieve_knowledge(
        workspace_id=workspace_id,
        query="fourteen days refund policy",
        top_k=5,
    )
    assert hits
    assert all(hit["metadata"]["workspace_id"] == workspace_id for hit in hits)
    assert all(hit["metadata"]["document_id"] == foreign["_id"] for hit in hits)
    assert all(hit["metadata"]["owner_id"] == "not-the-current-user" for hit in hits)

    other_hits = await retrieve_knowledge(
        workspace_id="workspace-other",
        query="fourteen days refund policy",
        top_k=5,
    )
    assert all(
        hit["metadata"]["document_id"] != foreign["_id"] for hit in other_hits
    )


@pytest.mark.asyncio
async def test_team_membership_isolates_by_workspace_id_not_owner_id(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user, headers = await _register_and_login(client, sample_register_payload)
    me = await _me(client, headers)
    workspace_id = me["default_workspace_id"]
    foreign = build_team_member_document(
        owner_id="not-the-current-user",
        first_name="Pat",
        last_name="Lee",
        email="foreign-member@acme.example",
        role="AGENT",
        status="ACTIVE",
        workspace_id=workspace_id,
    )
    leaked = build_team_member_document(
        owner_id=user["id"],
        first_name="Leaked",
        last_name="Member",
        email="leaked-member@acme.example",
        role="AGENT",
        status="ACTIVE",
        workspace_id="workspace-other",
    )
    db = mongodb_module.get_database()
    await db.team_members.insert_one(foreign)
    await db.team_members.insert_one(leaked)

    listed = await client.get("/api/v1/team", headers=headers)
    assert listed.status_code == 200
    ids = _ids(listed.json())
    emails = {item["email"] for item in listed.json()["items"]}
    assert foreign["_id"] in ids
    assert leaked["_id"] not in ids
    assert "foreign-member@acme.example" in emails
    assert "leaked-member@acme.example" not in emails


@pytest.mark.asyncio
async def test_same_user_can_reuse_team_email_in_another_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user, headers = await _register_and_login(
        client,
        {**sample_register_payload, "email": "team-email-owner@acme.example"},
    )
    other, _ = await _register_and_login(
        client,
        {**sample_register_payload, "email": "team-email-host@acme.example"},
    )
    await _add_admin_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
    )
    payload = {
        "first_name": "Sarah",
        "last_name": "Perera",
        "email": "shared-agent@acme.example",
        "role": "AGENT",
        "status": "ACTIVE",
    }
    first = await client.post("/api/v1/team", headers=headers, json=payload)
    assert first.status_code == 201, first.text

    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    second = await client.post("/api/v1/team", headers=headers, json=payload)
    assert second.status_code == 201, second.text
    assert second.json()["email"] == first.json()["email"]
    assert second.json()["workspace_id"] != first.json()["workspace_id"]

    duplicate = await client.post("/api/v1/team", headers=headers, json=payload)
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_client_workspace_id_cannot_read_another_workspace_customer(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    _, headers = await _register_and_login(
        client,
        {**sample_register_payload, "email": "spoof-customer@acme.example"},
    )
    other, other_headers = await _register_and_login(
        client,
        {**sample_register_payload, "email": "spoof-host@acme.example"},
    )
    created = await client.post(
        "/api/v1/customers",
        headers=other_headers,
        json={
            "first_name": "Other",
            "last_name": "Tenant",
            "email": "other-tenant@acme.example",
            "workspace_id": other["default_workspace_id"],
        },
    )
    assert created.status_code == 201
    detail = await client.get(
        f"/api/v1/customers/{created.json()['id']}",
        headers=headers,
        params={"workspace_id": other["default_workspace_id"]},
    )
    assert detail.status_code == 404
