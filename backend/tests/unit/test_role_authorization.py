"""Phase 1F workspace role authorization tests."""

import pytest
from httpx import AsyncClient

from app.auth.roles import (
    KNOWLEDGE_MANAGE_FORBIDDEN,
    TEAM_MANAGE_FORBIDDEN,
    WORKSPACE_UPDATE_FORBIDDEN,
)
from app.core.security import create_access_token, decode_access_token
from app.database import mongodb as mongodb_module
from tests.role_helpers import headers_as_workspace_role

SAMPLE_MEMBER = {
    "first_name": "Sarah",
    "last_name": "Perera",
    "email": "sarah-role@acme.example",
    "role": "AGENT",
    "status": "ACTIVE",
}

SAMPLE_DOCUMENT = {
    "title": "Handling duplicate invoice charges",
    "content": (
        "Verify invoice IDs, confirm payment processor status, "
        "then issue refund or credit memo within SLA."
    ),
    "source_type": "manual",
    "source": "Internal playbook",
    "status": "Published",
    "tags": ["billing", "refunds"],
}

SAMPLE_CUSTOMER = {
    "first_name": "Elena",
    "last_name": "Park",
    "email": "elena-role@acme.example",
    "phone": "+1-555-0100",
    "company": "Harbor Retail",
}

SAMPLE_TICKET = {
    "title": "Refund not received",
    "description": "Customer paid twice and needs the duplicate charge reversed.",
    "status": "OPEN",
    "priority": "HIGH",
}

SAMPLE_CONVERSATION = {
    "customer_name": "Elena Park",
    "customer_email": "elena-role@acme.example",
    "subject": "Duplicate March charge",
    "channel": "Chat",
    "status": "Open",
    "initial_message": "I was charged twice for March — can you refund one?",
}


async def _me(client: AsyncClient, headers: dict[str, str]) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


async def _workspace_id(client: AsyncClient, headers: dict[str, str]) -> str:
    me = await _me(client, headers)
    return me["default_workspace_id"]


async def _member_headers(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
    *,
    email: str,
    role: str,
) -> tuple[dict, dict[str, str]]:
    owner = await _me(client, auth_headers)
    return await headers_as_workspace_role(
        client,
        sample_register_payload,
        email=email,
        role=role,
        workspace_id=owner["default_workspace_id"],
        owner_id=owner["id"],
    )


# --- Workspace ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_owner_can_update_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    workspace_id = await _workspace_id(client, auth_headers)
    response = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=auth_headers,
        json={"name": "Owner Renamed"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Owner Renamed"
    assert response.json()["role"] == "OWNER"


@pytest.mark.asyncio
async def test_admin_can_update_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    workspace_id = await _workspace_id(client, auth_headers)
    _user, admin_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="admin-workspace@acme.example",
        role="ADMIN",
    )
    response = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=admin_headers,
        json={"name": "Admin Renamed"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Admin Renamed"
    assert response.json()["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_agent_gets_403_on_workspace_update(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    workspace_id = await _workspace_id(client, auth_headers)
    _user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-workspace@acme.example",
        role="AGENT",
    )
    response = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=agent_headers,
        json={"name": "Hacked"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == WORKSPACE_UPDATE_FORBIDDEN

    still = await client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=agent_headers,
    )
    assert still.status_code == 200
    assert still.json()["name"] != "Hacked"
    assert still.json()["role"] == "AGENT"


@pytest.mark.asyncio
async def test_cross_workspace_update_remains_isolated(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    workspace_id = await _workspace_id(client, auth_headers)
    other_payload = {
        **sample_register_payload,
        "email": "other-workspace-role@acme.example",
        "company_name": "Other Co",
    }
    await client.post("/api/v1/auth/register", json=other_payload)
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": other_payload["email"],
            "password": other_payload["password"],
        },
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=other_headers,
        json={"name": "Stolen"},
    )
    assert response.status_code == 404


# --- Team ---------------------------------------------------------------------


@pytest.mark.asyncio
async def test_owner_can_create_update_delete_team_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json=SAMPLE_MEMBER,
    )
    assert created.status_code == 201
    member_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/team/{member_id}",
        headers=auth_headers,
        json={"role": "ADMIN", "first_name": "Sara"},
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "ADMIN"

    deleted = await client.delete(
        f"/api/v1/team/{member_id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_admin_can_create_update_delete_team_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    _user, admin_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="admin-team@acme.example",
        role="ADMIN",
    )
    created = await client.post(
        "/api/v1/team",
        headers=admin_headers,
        json={**SAMPLE_MEMBER, "email": "admin-created@acme.example"},
    )
    assert created.status_code == 201
    member_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/team/{member_id}",
        headers=admin_headers,
        json={"status": "DISABLED"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "DISABLED"

    deleted = await client.delete(
        f"/api/v1/team/{member_id}",
        headers=admin_headers,
    )
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_agent_gets_403_on_team_mutation(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json=SAMPLE_MEMBER,
    )
    assert created.status_code == 201
    member_id = created.json()["id"]

    _user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-team@acme.example",
        role="AGENT",
    )

    listed = await client.get("/api/v1/team", headers=agent_headers)
    assert listed.status_code == 200
    assert any(item["id"] == member_id for item in listed.json()["items"])

    detail = await client.get(
        f"/api/v1/team/{member_id}",
        headers=agent_headers,
    )
    assert detail.status_code == 200

    create_attempt = await client.post(
        "/api/v1/team",
        headers=agent_headers,
        json={**SAMPLE_MEMBER, "email": "agent-created@acme.example", "role": "ADMIN"},
    )
    assert create_attempt.status_code == 403
    assert create_attempt.json()["detail"] == TEAM_MANAGE_FORBIDDEN

    patched = await client.patch(
        f"/api/v1/team/{member_id}",
        headers=agent_headers,
        json={"first_name": "Hijacked"},
    )
    assert patched.status_code == 403

    deleted = await client.delete(
        f"/api/v1/team/{member_id}",
        headers=agent_headers,
    )
    assert deleted.status_code == 403

    still = await client.get(
        f"/api/v1/team/{member_id}",
        headers=auth_headers,
    )
    assert still.status_code == 200
    assert still.json()["first_name"] == "Sarah"


@pytest.mark.asyncio
async def test_owner_cannot_be_deleted_or_have_role_changed(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _me(client, auth_headers)
    demoted = await client.patch(
        f"/api/v1/team/{me['id']}",
        headers=auth_headers,
        json={"role": "ADMIN"},
    )
    assert demoted.status_code == 403

    deleted = await client.delete(
        f"/api/v1/team/{me['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 403
    assert deleted.json()["detail"] == "The workspace owner cannot be removed."


@pytest.mark.asyncio
async def test_cross_workspace_member_access_remains_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json=SAMPLE_MEMBER,
    )
    member_id = created.json()["id"]
    other_payload = {
        **sample_register_payload,
        "email": "other-team-role@acme.example",
    }
    await client.post("/api/v1/auth/register", json=other_payload)
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": other_payload["email"],
            "password": other_payload["password"],
        },
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    detail = await client.get(
        f"/api/v1/team/{member_id}",
        headers=other_headers,
    )
    assert detail.status_code == 404


# --- Knowledge ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_owner_and_admin_can_mutate_knowledge(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert created.status_code == 201
    document_id = created.json()["id"]

    unpublished = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
        json={"status": "Draft"},
    )
    assert unpublished.status_code == 200
    assert unpublished.json()["status"] == "Draft"

    _user, admin_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="admin-knowledge@acme.example",
        role="ADMIN",
    )
    admin_created = await client.post(
        "/api/v1/knowledge-documents",
        headers=admin_headers,
        json={**SAMPLE_DOCUMENT, "title": "Admin article"},
    )
    assert admin_created.status_code == 201
    admin_id = admin_created.json()["id"]

    published = await client.patch(
        f"/api/v1/knowledge-documents/{admin_id}",
        headers=admin_headers,
        json={"status": "Published"},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "Published"

    ingested = await client.post(
        f"/api/v1/knowledge-documents/{admin_id}/ingest",
        headers=admin_headers,
    )
    assert ingested.status_code == 200

    deleted = await client.delete(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=admin_headers,
    )
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_agent_can_read_knowledge_but_not_mutate(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert created.status_code == 201
    document_id = created.json()["id"]

    _user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-knowledge@acme.example",
        role="AGENT",
    )

    listed = await client.get(
        "/api/v1/knowledge-documents",
        headers=agent_headers,
    )
    assert listed.status_code == 200
    assert any(item["id"] == document_id for item in listed.json()["items"])

    detail = await client.get(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=agent_headers,
    )
    assert detail.status_code == 200

    create_attempt = await client.post(
        "/api/v1/knowledge-documents",
        headers=agent_headers,
        json={**SAMPLE_DOCUMENT, "title": "Agent article", "role": "OWNER"},
    )
    assert create_attempt.status_code == 403
    assert create_attempt.json()["detail"] == KNOWLEDGE_MANAGE_FORBIDDEN

    patched = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=agent_headers,
        json={"status": "Draft"},
    )
    assert patched.status_code == 403

    published = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=agent_headers,
        json={"status": "Published"},
    )
    assert published.status_code == 403

    ingested = await client.post(
        f"/api/v1/knowledge-documents/{document_id}/ingest",
        headers=agent_headers,
    )
    assert ingested.status_code == 403

    deleted = await client.delete(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=agent_headers,
    )
    assert deleted.status_code == 403

    still = await client.get(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert still.status_code == 200
    assert still.json()["status"] == "Published"


@pytest.mark.asyncio
async def test_agent_can_search_knowledge(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert created.status_code == 201
    _user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-search@acme.example",
        role="AGENT",
    )
    searched = await client.post(
        "/api/v1/knowledge/search",
        headers=agent_headers,
        json={"query": "duplicate invoice charges", "top_k": 5},
    )
    assert searched.status_code == 200
    assert searched.json()["query"] == "duplicate invoice charges"


# --- Other application workflows ----------------------------------------------


@pytest.mark.asyncio
async def test_agent_can_use_ticket_conversation_customer_and_ai(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    customer = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json=SAMPLE_CUSTOMER,
    )
    assert customer.status_code == 201
    customer_id = customer.json()["id"]

    _user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-ops@acme.example",
        role="AGENT",
    )

    listed_customers = await client.get("/api/v1/customers", headers=agent_headers)
    assert listed_customers.status_code == 200
    assert any(item["id"] == customer_id for item in listed_customers.json()["items"])

    created_customer = await client.post(
        "/api/v1/customers",
        headers=agent_headers,
        json={**SAMPLE_CUSTOMER, "email": "agent-customer@acme.example"},
    )
    assert created_customer.status_code == 201

    ticket = await client.post(
        "/api/v1/tickets",
        headers=agent_headers,
        json={**SAMPLE_TICKET, "customer_id": customer_id},
    )
    assert ticket.status_code == 201
    ticket_id = ticket.json()["id"]

    updated_ticket = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=agent_headers,
        json={"status": "PENDING"},
    )
    assert updated_ticket.status_code == 200
    assert updated_ticket.json()["status"] == "PENDING"

    conversation = await client.post(
        "/api/v1/conversations",
        headers=agent_headers,
        json=SAMPLE_CONVERSATION,
    )
    assert conversation.status_code == 201
    conversation_id = conversation.json()["id"]

    messages = await client.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=agent_headers,
    )
    assert messages.status_code == 200

    ai = await client.post(
        "/api/v1/ai/answer",
        headers=agent_headers,
        json={"question": "What is the refund window?"},
    )
    assert ai.status_code != 403
    assert ai.status_code != 401


# --- Security -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_role_in_request_body_cannot_escalate_privileges(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    workspace_id = await _workspace_id(client, auth_headers)
    _user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-escalate@acme.example",
        role="AGENT",
    )
    response = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=agent_headers,
        json={"name": "Escalated", "role": "OWNER", "owner_user_id": "stolen"},
    )
    assert response.status_code == 403

    knowledge = await client.post(
        "/api/v1/knowledge-documents",
        headers=agent_headers,
        json={**SAMPLE_DOCUMENT, "role": "OWNER", "workspace_id": workspace_id},
    )
    assert knowledge.status_code == 403


@pytest.mark.asyncio
async def test_client_workspace_id_cannot_switch_authorization_context(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    owner = await _me(client, auth_headers)
    _user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-switch@acme.example",
        role="AGENT",
    )
    response = await client.post(
        "/api/v1/knowledge-documents",
        headers=agent_headers,
        json={
            **SAMPLE_DOCUMENT,
            "workspace_id": owner["id"],
            "owner_id": owner["id"],
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_jwt_role_claim_does_not_authorize(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    user, _headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-jwt@acme.example",
        role="AGENT",
    )
    login_token = _headers["Authorization"].removeprefix("Bearer ")
    payload = decode_access_token(login_token)
    assert payload["sub"] == user["id"]
    assert "role" not in payload
    assert "workspace_id" not in payload

    forged = create_access_token(
        user["id"],
        extra_claims={"role": "OWNER", "workspace_id": user["default_workspace_id"]},
    )
    forged_headers = {"Authorization": f"Bearer {forged}"}
    response = await client.post(
        "/api/v1/knowledge-documents",
        headers=forged_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert response.status_code == 403
    assert response.json()["detail"] == KNOWLEDGE_MANAGE_FORBIDDEN


@pytest.mark.asyncio
async def test_disabled_membership_cannot_authorize_protected_operations(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    user, agent_headers = await _member_headers(
        client,
        sample_register_payload,
        auth_headers,
        email="agent-disabled@acme.example",
        role="AGENT",
    )
    db = mongodb_module.get_database()
    await db.team_members.update_many(
        {"user_id": user["id"]},
        {"$set": {"status": "DISABLED"}},
    )

    knowledge = await client.post(
        "/api/v1/knowledge-documents",
        headers=agent_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert knowledge.status_code == 403

    listed = await client.get("/api/v1/knowledge-documents", headers=agent_headers)
    assert listed.status_code == 403

    workspace_id = await _workspace_id(client, auth_headers)
    patched = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=agent_headers,
        json={"name": "Disabled"},
    )
    assert patched.status_code in {403, 404}
