"""Chroma workspace re-index tests (ephemeral Chroma + mongomock)."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.database.chroma import get_knowledge_collection, reset_chroma_client
from app.migrations.chroma_workspace_reindex import (
    format_chroma_reindex_report,
    run_chroma_workspace_reindex,
)
from app.models.knowledge import build_knowledge_document
from app.services.knowledge_ingestion import build_chunk_id


SAMPLE_PUBLISHED = {
    "title": "Reindex refund policy",
    "content": "Customers may request a refund within 14 days of purchase.",
    "source_type": "manual",
    "status": "Published",
    "tags": ["billing"],
}


@pytest.mark.asyncio
async def test_chroma_reindex_stamps_workspace_id_and_is_idempotent(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.status_code == 200
    workspace_id = me.json()["default_workspace_id"]
    owner_id = me.json()["id"]

    document = build_knowledge_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        title=SAMPLE_PUBLISHED["title"],
        content=SAMPLE_PUBLISHED["content"],
        status="Published",
        tags=["billing"],
    )
    db = mongodb_module.get_database()
    await db.knowledge_documents.insert_one(document)

    collection = get_knowledge_collection()
    collection.upsert(
        ids=[build_chunk_id(document["_id"], 0)],
        documents=[SAMPLE_PUBLISHED["content"]],
        metadatas=[
            {
                "document_id": document["_id"],
                "owner_id": owner_id,
                "title": SAMPLE_PUBLISHED["title"],
                "status": "Published",
                "source_type": "manual",
                "source": "",
                "tags": "billing",
                "chunk_index": 0,
                "chunk_count": 1,
            },
        ],
    )
    legacy = collection.get(ids=[build_chunk_id(document["_id"], 0)])
    assert "workspace_id" not in (legacy["metadatas"][0] or {})

    first = await run_chroma_workspace_reindex(db, dry_run=False)
    assert first.planned == 1
    assert first.indexed == 1
    assert first.failed == 0
    assert first.skipped_missing_workspace == 0

    stored = collection.get(ids=[build_chunk_id(document["_id"], 0)])
    metadata = stored["metadatas"][0]
    assert metadata["workspace_id"] == workspace_id
    assert metadata["owner_id"] == owner_id
    assert metadata["status"] == "Published"
    assert metadata["document_id"] == document["_id"]

    persisted = await db.knowledge_documents.find_one({"_id": document["_id"]})
    assert persisted["ingestion_status"] == "indexed"
    assert persisted["chunk_count"] >= 1

    second = await run_chroma_workspace_reindex(db, dry_run=False)
    assert second.planned == 1
    assert second.indexed == 1
    assert second.failed == 0
    after = collection.get(
        where={
            "$and": [
                {"document_id": document["_id"]},
                {"workspace_id": workspace_id},
            ],
        },
    )
    assert len(after["ids"]) == persisted["chunk_count"]


@pytest.mark.asyncio
async def test_chroma_reindex_dry_run_does_not_write(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    workspace_id = me.json()["default_workspace_id"]
    document = build_knowledge_document(
        owner_id=me.json()["id"],
        workspace_id=workspace_id,
        title="Dry run policy",
        content="Should not be indexed during dry-run.",
        status="Published",
    )
    db = mongodb_module.get_database()
    await db.knowledge_documents.insert_one(document)

    report = await run_chroma_workspace_reindex(db, dry_run=True)
    assert report.dry_run is True
    assert report.planned == 1
    assert report.indexed == 0
    assert document["_id"] in report.document_ids

    collection = get_knowledge_collection()
    stored = collection.get(where={"document_id": document["_id"]})
    assert stored["ids"] == []

    output = format_chroma_reindex_report(report)
    assert "DRY RUN" in output
    assert "planned: 1" in output


@pytest.mark.asyncio
async def test_chroma_reindex_skips_published_docs_without_workspace_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    reset_chroma_client()
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    document = build_knowledge_document(
        owner_id=me.json()["id"],
        title="Unmapped published doc",
        content="No workspace_id; must not be invented.",
        status="Published",
    )
    assert "workspace_id" not in document
    db = mongodb_module.get_database()
    await db.knowledge_documents.insert_one(document)

    report = await run_chroma_workspace_reindex(db, dry_run=False)
    assert report.planned == 0
    assert report.indexed == 0
    assert report.skipped_missing_workspace == 1

    collection = get_knowledge_collection()
    stored = collection.get(where={"document_id": document["_id"]})
    assert stored["ids"] == []
