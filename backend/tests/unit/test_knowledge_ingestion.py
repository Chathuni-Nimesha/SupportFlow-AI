"""Knowledge ingestion / embedding tests."""

import pytest
from httpx import AsyncClient

from app.database.chroma import get_knowledge_collection, reset_chroma_client
from app.services.knowledge_ingestion import chunk_text


SAMPLE_PUBLISHED = {
    "title": "SSO troubleshooting",
    "content": (
        "Confirm IdP metadata, certificate expiry, and ACS URL. "
        "Retry login after clearing the browser session cookies. "
    )
    * 20,
    "source_type": "manual",
    "status": "Published",
    "tags": ["sso"],
}

SAMPLE_DRAFT = {
    "title": "Draft policy",
    "content": "This draft should not be embedded yet.",
    "source_type": "manual",
    "status": "Draft",
    "tags": [],
}


def test_chunk_text_splits_long_content() -> None:
    text = "word " * 500
    chunks = chunk_text(text, chunk_size=100, overlap=20)
    assert len(chunks) > 1
    assert all(chunk for chunk in chunks)


@pytest.mark.asyncio
async def test_published_document_is_ingested(
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
    assert body["chunk_count"] >= 1
    assert body["ingested_at"] is not None

    collection = get_knowledge_collection()
    stored = collection.get(
        where={
            "$and": [
                {"document_id": body["id"]},
                {"owner_id": body["owner_id"]},
            ],
        },
    )
    assert len(stored["ids"]) == body["chunk_count"]


@pytest.mark.asyncio
async def test_draft_document_is_not_indexed(
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
    assert body["chunk_count"] == 0

    collection = get_knowledge_collection()
    stored = collection.get(
        where={
            "$and": [
                {"document_id": body["id"]},
                {"owner_id": body["owner_id"]},
            ],
        },
    )
    assert stored["ids"] == []


@pytest.mark.asyncio
async def test_manual_ingest_endpoint(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_DRAFT,
    )
    document_id = created.json()["id"]

    published = await client.patch(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
        json={"status": "Published"},
    )
    assert published.status_code == 200
    assert published.json()["ingestion_status"] == "indexed"

    reinjected = await client.post(
        f"/api/v1/knowledge-documents/{document_id}/ingest",
        headers=auth_headers,
    )
    assert reinjected.status_code == 200
    payload = reinjected.json()
    assert payload["ingestion_status"] == "indexed"
    assert payload["chunk_count"] >= 1
    assert "embedded successfully" in payload["message"].lower()


@pytest.mark.asyncio
async def test_delete_removes_chroma_chunks(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    created = await client.post(
        "/api/v1/knowledge-documents",
        headers=auth_headers,
        json=SAMPLE_PUBLISHED,
    )
    body = created.json()
    document_id = body["id"]
    owner_id = body["owner_id"]

    deleted = await client.delete(
        f"/api/v1/knowledge-documents/{document_id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204

    collection = get_knowledge_collection()
    stored = collection.get(
        where={
            "$and": [
                {"document_id": document_id},
                {"owner_id": owner_id},
            ],
        },
    )
    assert stored["ids"] == []
