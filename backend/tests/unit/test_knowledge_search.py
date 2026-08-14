"""Authenticated knowledge search API tests."""

import pytest
from httpx import AsyncClient

from app.database.chroma import reset_chroma_client


SAMPLE_PUBLISHED = {
    "title": "Refund policy",
    "content": (
        "Customers may request a refund within 14 days of purchase. "
        "Refunds are issued to the original payment method within 5 business days."
    ),
    "source_type": "manual",
    "status": "Published",
    "tags": ["billing", "refunds"],
}

SAMPLE_DRAFT = {
    "title": "Secret draft refund notes",
    "content": "Draft-only wording that must never appear in search results.",
    "source_type": "manual",
    "status": "Draft",
    "tags": ["billing"],
}


@pytest.mark.asyncio
async def test_knowledge_search_requires_auth(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/knowledge/search",
        json={"query": "refund policy", "top_k": 5},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_knowledge_search_returns_own_published_chunks(
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
    assert created.json()["ingestion_status"] == "indexed"

    response = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json={"query": "What is the refund policy?", "top_k": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "What is the refund policy?"
    assert body["top_k"] == 5
    assert body["count"] >= 1
    assert len(body["results"]) == body["count"]

    hit = body["results"][0]
    assert "refund" in hit["document"].lower()
    assert hit["metadata"]["document_id"] == created.json()["id"]
    assert hit["metadata"]["status"] == "Published"
    assert "distance" in hit
    assert "score" in hit


@pytest.mark.asyncio
async def test_knowledge_search_is_owner_scoped(
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

    other_payload = {
        **sample_register_payload,
        "email": "search-other@acme.example",
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

    response = await client.post(
        "/api/v1/knowledge/search",
        headers=other_headers,
        json={"query": "refund policy payment method", "top_k": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 0
    assert body["results"] == []


@pytest.mark.asyncio
async def test_knowledge_search_excludes_drafts(
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
    assert created.json()["ingestion_status"] == "not_indexed"

    response = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json={"query": "secret draft refund notes", "top_k": 5},
    )
    assert response.status_code == 200
    assert response.json()["count"] == 0
    assert response.json()["results"] == []


@pytest.mark.asyncio
async def test_knowledge_search_rejects_empty_query(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json={"query": "   ", "top_k": 5},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_knowledge_search_top_k_validation(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    too_low = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json={"query": "refund", "top_k": 0},
    )
    assert too_low.status_code == 422

    too_high = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json={"query": "refund", "top_k": 100},
    )
    assert too_high.status_code == 422


@pytest.mark.asyncio
async def test_knowledge_search_empty_results_are_valid(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    response = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json={"query": "completely unrelated topic xyz", "top_k": 3},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "completely unrelated topic xyz"
    assert body["top_k"] == 3
    assert body["count"] == 0
    assert body["results"] == []


@pytest.mark.asyncio
async def test_knowledge_crud_still_works_after_search_route(
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
    document_id = created.json()["id"]

    listed = await client.get(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    detail = await client.get(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["id"] == document_id
