"""Knowledge retrieval (Chroma similarity search) tests."""

import pytest
from httpx import AsyncClient

from app.database.chroma import reset_chroma_client
from app.services.knowledge_retrieval import (
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
        owner_id=body["owner_id"],
        query="How do customers reset their password?",
        top_k=5,
    )

    assert len(results) >= 1
    top = results[0]
    assert "password" in top["document"].lower()
    assert top["metadata"]["owner_id"] == body["owner_id"]
    assert top["metadata"]["document_id"] == body["id"]
    assert top["metadata"]["status"] == "Published"
    assert top["distance"] is not None
    assert top["score"] is not None


@pytest.mark.asyncio
async def test_retrieve_is_owner_scoped(
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
    owner_a = created.json()["owner_id"]

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
    owner_b = other_me.json()["id"]
    assert owner_b != owner_a

    results = await retrieve_knowledge(
        owner_id=owner_b,
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
        owner_id=body["owner_id"],
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
    owner_id = created.json()["owner_id"]

    assert await retrieve_knowledge(owner_id=owner_id, query="   ") == []
    assert await retrieve_knowledge(owner_id="", query="shipping") == []

    # Owner with no indexed docs
    assert await retrieve_knowledge(owner_id="no-such-owner", query="shipping") == []


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
        owner_id=body["owner_id"],
        query="billing disputes invoice refund authentication",
        top_k=1,
    )
    assert len(results) == 1

    results_many = await retrieve_knowledge(
        owner_id=body["owner_id"],
        query="billing disputes invoice refund authentication",
        top_k=3,
    )
    assert 1 <= len(results_many) <= 3
    assert len(results_many) <= body["chunk_count"]
