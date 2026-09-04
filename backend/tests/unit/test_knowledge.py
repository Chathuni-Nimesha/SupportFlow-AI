"""Knowledge document API tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.knowledge import build_knowledge_document


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


@pytest.mark.asyncio
async def test_list_knowledge_documents_requires_auth(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/v1/knowledge-documents")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_knowledge_document(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == SAMPLE_DOCUMENT["title"]
    assert body["content"].startswith("Verify invoice IDs")
    assert body["source_type"] == "manual"
    assert body["source"] == "Internal playbook"
    assert body["status"] == "Published"
    assert body["tags"] == ["billing", "refunds"]
    assert "id" in body
    assert "owner_id" in body
    assert "workspace_id" in body
    assert "created_at" in body
    assert "updated_at" in body


@pytest.mark.asyncio
async def test_list_knowledge_documents(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert created.status_code == 201

    listed = await client.get(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert listed.json()["total"] == 1
    assert listed.json()["has_next"] is False
    assert len(items) == 1
    assert items[0]["id"] == created.json()["id"]


@pytest.mark.asyncio
async def test_get_knowledge_document(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    document_id = created.json()["id"]

    response = await client.get(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["id"] == document_id
    assert response.json()["title"] == SAMPLE_DOCUMENT["title"]


@pytest.mark.asyncio
async def test_update_knowledge_document(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    document_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
        json={
            "title": "Updated billing policy",
            "status": "Draft",
            "tags": ["billing"],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "Updated billing policy"
    assert body["status"] == "Draft"
    assert body["tags"] == ["billing"]
    assert body["content"] == SAMPLE_DOCUMENT["content"]


@pytest.mark.asyncio
async def test_delete_knowledge_document(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    document_id = created.json()["id"]

    deleted = await client.delete(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204

    missing = await client.get(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_get_knowledge_document_not_found(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/knowledge-documents/does-not-exist",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_knowledge_documents_are_scoped_to_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    document_id = created.json()["id"]

    other_payload = {
        **sample_register_payload,
        "email": "other-kb@acme.example",
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

    listed = await client.get(
        "/api/v1/knowledge-documents",
        headers=other_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    assert listed.json()["total"] == 0

    detail = await client.get(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=other_headers,
    )
    assert detail.status_code == 404

    patched = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=other_headers,
        json={"status": "Draft"},
    )
    assert patched.status_code == 404

    deleted = await client.delete(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=other_headers,
    )
    assert deleted.status_code == 404

    still_there = await client.get(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert still_there.status_code == 200
    owner = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert still_there.json()["workspace_id"] == owner.json()["default_workspace_id"]
    assert still_there.json()["owner_id"] == owner.json()["id"]


async def _current_user(
    client: AsyncClient,
    headers: dict[str, str],
) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


@pytest.mark.asyncio
async def test_create_knowledge_stamps_workspace_and_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["workspace_id"] != me["id"]
    assert body["owner_id"] == me["id"]


@pytest.mark.asyncio
async def test_create_knowledge_ignores_client_workspace_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    response = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json={
            **SAMPLE_DOCUMENT,
            "workspace_id": me["id"],
            "owner_id": "forged-owner",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["workspace_id"] != me["id"]
    assert body["owner_id"] == me["id"]


@pytest.mark.asyncio
async def test_update_knowledge_ignores_client_workspace_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DOCUMENT,
    )
    document_id = created.json()["id"]
    me = await _current_user(client, auth_headers)

    updated = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
        json={
            "status": "Draft",
            "workspace_id": me["id"],
            "owner_id": "forged-owner",
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["status"] == "Draft"
    assert body["workspace_id"] == me["default_workspace_id"]
    assert body["owner_id"] == me["id"]
    assert body["ingestion_status"] == "not_indexed"


@pytest.mark.asyncio
async def test_backfilled_knowledge_document_is_accessible(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    document = build_knowledge_document(
        owner_id=me["id"],
        workspace_id=me["default_workspace_id"],
        title="Backfilled refund policy",
        content="Seeded before knowledge tenancy cutover.",
        status="Draft",
    )
    db = mongodb_module.get_database()
    await db.knowledge_documents.insert_one(document)

    listed = await client.get("/api/v1/knowledge-documents", headers=auth_headers)
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["items"]]
    assert document["_id"] in ids

    detail = await client.get(
        f"/api/v1/knowledge-documents/{document['_id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["workspace_id"] == me["default_workspace_id"]
    assert detail.json()["owner_id"] == me["id"]
    assert detail.json()["title"] == "Backfilled refund policy"


@pytest.mark.asyncio
async def test_knowledge_list_pagination_still_works(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    for index in range(3):
        created = await client.post(
            "/api/v1/knowledge-documents",
            headers=auth_headers,
            json={
                **SAMPLE_DOCUMENT,
                "title": f"Policy {index}",
                "status": "Draft",
            },
        )
        assert created.status_code == 201

    response = await client.get(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        params={"page": 1, "page_size": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["items"]) == 2
    assert body["has_next"] is True
