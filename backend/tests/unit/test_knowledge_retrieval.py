"""Knowledge retrieval (Chroma similarity search) tests."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.database.chroma import reset_chroma_client
from app.services.knowledge_retrieval import (
    chroma_published_workspace_filter,
    normalize_top_k,
    retrieve_knowledge,
)


SAMPLE_PUBLISHED = {
    "title": "Password reset policy",
    "content": (
        "Customers can reset passwords from the account security page. "
        "Require email verification before allowing a password change. "
        "Never send passwords in plaintext email."
    ),
    "source_type": "manual",
    "status": "Published",
    "tags": ["security", "password"],
}

SAMPLE_DRAFT = {
    "title": "Unpublished refund notes",
    "content": "Draft refund wording that must not appear in retrieval.",
    "source_type": "manual",
    "status": "Draft",
    "tags": ["billing"],
}

SAMPLE_OTHER_TOPIC = {
    "title": "Warehouse shipping SLA",
    "content": (
        "Warehouse orders ship within two business days. "
        "International freight requires customs paperwork."
    ),
    "source_type": "manual",
    "status": "Published",
    "tags": ["shipping"],
}


def test_normalize_top_k_clamps_values() -> None:
    assert normalize_top_k(None) == 5
    assert normalize_top_k(0) == 1
    assert normalize_top_k(-3) == 1
    assert normalize_top_k(3) == 3
    assert normalize_top_k(100) == 20


@pytest.mark.asyncio
async def test_retrieve_published_document(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_PUBLISHED,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["ingestion_status"] == "indexed"

    results = await retrieve_knowledge(
        workspace_id=body["workspace_id"],
        query="How do customers reset their password?",
        top_k=5,
    )

    assert len(results) >= 1
    top = results[0]
    assert "password" in top["document"].lower()
    assert top["metadata"]["workspace_id"] == body["workspace_id"]
    assert top["metadata"]["owner_id"] == body["owner_id"]
    assert top["metadata"]["document_id"] == body["id"]
    assert top["metadata"]["status"] == "Published"
    assert top["distance"] is not None
    assert top["score"] is not None


@pytest.mark.asyncio
async def test_retrieve_is_workspace_scoped(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_PUBLISHED,
    )
    assert created.status_code == 201
    workspace_a = created.json()["workspace_id"]

    other_payload = {
        **sample_register_payload,
        "email": "retrieval-other@acme.example",
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
    other_me = await client.get("/api/v1/auth/me", headers=other_headers)
    workspace_b = other_me.json()["default_workspace_id"]
    assert workspace_b != workspace_a

    results = await retrieve_knowledge(
        workspace_id=workspace_b,
        query="password reset email verification",
        top_k=5,
    )
    assert results == []


@pytest.mark.asyncio
async def test_draft_documents_are_not_retrieved(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DRAFT,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["ingestion_status"] == "not_indexed"

    results = await retrieve_knowledge(
        workspace_id=body["workspace_id"],
        query="unpublished refund notes wording",
        top_k=5,
    )
    assert results == []


@pytest.mark.asyncio
async def test_retrieve_handles_empty_query_and_no_matches(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_OTHER_TOPIC,
    )
    assert created.status_code == 201
    workspace_id = created.json()["workspace_id"]

    assert await retrieve_knowledge(workspace_id=workspace_id, query="   ") == []
    assert await retrieve_knowledge(workspace_id="", query="shipping") == []

    # Workspace with no indexed docs
    assert await retrieve_knowledge(workspace_id="no-such-workspace", query="shipping") == []


@pytest.mark.asyncio
async def test_retrieve_respects_top_k(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    long_doc = {
        "title": "Extended support handbook",
        "content": (
            "Section about billing disputes and invoice corrections. "
            "Section about account access and multi-factor authentication. "
            "Section about refund timelines and payment processor status. "
        )
        * 40,
        "source_type": "manual",
        "status": "Published",
        "tags": ["handbook"],
    }
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=long_doc,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["chunk_count"] >= 2

    results = await retrieve_knowledge(
        workspace_id=body["workspace_id"],
        query="billing disputes invoice refund authentication",
        top_k=1,
    )
    assert len(results) == 1

    results_many = await retrieve_knowledge(
        workspace_id=body["workspace_id"],
        query="billing disputes invoice refund authentication",
        top_k=3,
    )
    assert 1 <= len(results_many) <= 3
    assert len(results_many) <= body["chunk_count"]


@pytest.mark.asyncio
async def test_chroma_query_receives_workspace_metadata_filter() -> None:
    fake_collection = MagicMock()
    fake_collection.query.return_value = {
        "ids": [[]],
        "documents": [[]],
        "metadatas": [[]],
        "distances": [[]],
    }
    with patch(
        "app.services.knowledge_retrieval.get_knowledge_collection",
        return_value=fake_collection,
    ):
        results = await retrieve_knowledge(
            workspace_id="workspace-a",
            query="refund policy",
            top_k=5,
        )

    assert results == []
    fake_collection.query.assert_called_once()
    where = fake_collection.query.call_args.kwargs["where"]
    assert where == chroma_published_workspace_filter("workspace-a")
    assert where == {
        "$and": [
            {"workspace_id": "workspace-a"},
            {"status": "Published"},
        ],
    }
    serialized = str(where)
    assert "owner_id" not in serialized


@pytest.mark.asyncio
async def test_same_content_is_isolated_across_workspaces(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    reset_chroma_client()
    created_a = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_PUBLISHED,
    )
    assert created_a.status_code == 201
    workspace_a = created_a.json()["workspace_id"]

    other_payload = {
        **sample_register_payload,
        "email": "same-content-kb@acme.example",
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
    created_b = await client.post(
        "/api/v1/knowledge-documents",
        headers=other_headers,
        json=SAMPLE_PUBLISHED,
    )
    assert created_b.status_code == 201
    workspace_b = created_b.json()["workspace_id"]
    assert workspace_a != workspace_b

    hits_a = await retrieve_knowledge(
        workspace_id=workspace_a,
        query="password reset email verification",
        top_k=5,
    )
    hits_b = await retrieve_knowledge(
        workspace_id=workspace_b,
        query="password reset email verification",
        top_k=5,
    )
    assert len(hits_a) >= 1
    assert len(hits_b) >= 1
    assert all(hit["metadata"]["workspace_id"] == workspace_a for hit in hits_a)
    assert all(hit["metadata"]["workspace_id"] == workspace_b for hit in hits_b)
    assert all(hit["metadata"]["document_id"] == created_a.json()["id"] for hit in hits_a)
    assert all(hit["metadata"]["document_id"] == created_b.json()["id"] for hit in hits_b)
    assert all(hit["metadata"].get("owner_id") for hit in hits_a)


@pytest.mark.asyncio
async def test_retrieve_does_not_accept_owner_id_as_tenant(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_PUBLISHED,
    )
    assert created.status_code == 201
    body = created.json()

    with pytest.raises(TypeError):
        await retrieve_knowledge(
            owner_id=body["owner_id"],  # type: ignore[call-arg]
            query="password reset",
            top_k=5,
        )
