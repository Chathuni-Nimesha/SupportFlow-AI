"""Knowledge document chunking and ChromaDB ingestion."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from app.config.settings import get_settings
from app.core.logging import get_logger
from app.database.chroma import get_knowledge_collection

logger = get_logger(__name__)

DEFAULT_CHUNK_SIZE = 800
DEFAULT_CHUNK_OVERLAP = 120


def utc_now() -> datetime:
    return datetime.now(UTC)


def chunk_text(
    text: str,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """Split text into overlapping character chunks for embedding."""
    cleaned = " ".join(text.split()).strip()
    if not cleaned:
        return []

    if len(cleaned) <= chunk_size:
        return [cleaned]

    step = max(chunk_size - overlap, 1)
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start += step
    return chunks


def build_chunk_id(document_id: str, chunk_index: int) -> str:
    return f"{document_id}::chunk::{chunk_index}"


def chroma_document_delete_filter(
    document_id: str,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Chroma delete filter. Include workspace_id when known (defense in depth)."""
    cleaned_document = str(document_id or "").strip()
    cleaned_workspace = str(workspace_id or "").strip()
    if cleaned_workspace:
        return {
            "$and": [
                {"document_id": cleaned_document},
                {"workspace_id": cleaned_workspace},
            ],
        }
    return {"document_id": cleaned_document}


def _delete_document_chunks_sync(
    document_id: str,
    workspace_id: str | None = None,
) -> int:
    """Remove chunks for a document. Prefer workspace-scoped deletes."""
    collection = get_knowledge_collection()
    collection.delete(
        where=chroma_document_delete_filter(document_id, workspace_id),
    )
    return 0


def _upsert_document_chunks_sync(document: dict[str, Any]) -> int:
    document_id = str(document["_id"])
    owner_id = str(document["owner_id"])
    workspace_id = str(document.get("workspace_id") or "").strip()
    if not workspace_id:
        raise ValueError("workspace_id is required to index knowledge chunks.")

    title = str(document.get("title") or "")
    content = str(document.get("content") or "")
    status = str(document.get("status") or "Draft")
    source_type = str(document.get("source_type") or "manual")
    source = document.get("source")
    tags = document.get("tags") or []

    chunks = chunk_text(f"{title}\n\n{content}")
    collection = get_knowledge_collection()

    # Replace previous vectors for this document in the current workspace.
    collection.delete(
        where=chroma_document_delete_filter(document_id, workspace_id),
    )

    if not chunks:
        return 0

    ids = [build_chunk_id(document_id, index) for index in range(len(chunks))]
    # owner_id is compatibility metadata only. Retrieval filters on workspace_id.
    metadatas = [
        {
            "document_id": document_id,
            "owner_id": owner_id,
            "workspace_id": workspace_id,
            "title": title[:300],
            "status": status,
            "source_type": source_type,
            "source": (str(source)[:500] if source else ""),
            "tags": ",".join(str(tag) for tag in tags)[:500],
            "chunk_index": index,
            "chunk_count": len(chunks),
        }
        for index in range(len(chunks))
    ]

    collection.upsert(
        ids=ids,
        documents=chunks,
        metadatas=metadatas,
    )
    return len(chunks)


async def remove_document_embeddings(
    document_id: str,
    workspace_id: str | None = None,
) -> None:
    """Remove Chroma chunks for a knowledge document."""
    await asyncio.to_thread(
        _delete_document_chunks_sync,
        document_id,
        workspace_id,
    )


async def ingest_knowledge_document(document: dict[str, Any]) -> dict[str, Any]:
    """
    Embed and upsert a knowledge document into ChromaDB.

    Returns ingestion result fields suitable for MongoDB persistence.
    """
    workspace_id = str(document.get("workspace_id") or "").strip()
    status = document.get("status")
    if status != "Published":
        try:
            await remove_document_embeddings(
                str(document["_id"]),
                workspace_id or None,
            )
        except Exception:
            logger.exception(
                "Failed to clear embeddings for non-published document %s",
                document.get("_id"),
            )
        return {
            "ingestion_status": "not_indexed",
            "ingestion_error": None,
            "ingested_at": None,
            "chunk_count": 0,
        }

    if not workspace_id:
        return {
            "ingestion_status": "failed",
            "ingestion_error": (
                "Cannot index knowledge without workspace_id. "
                "Run the MongoDB workspace backfill, then Chroma re-index."
            ),
            "ingested_at": None,
            "chunk_count": 0,
        }

    try:
        chunk_count = await asyncio.to_thread(
            _upsert_document_chunks_sync,
            document,
        )
        return {
            "ingestion_status": "indexed",
            "ingestion_error": None,
            "ingested_at": utc_now(),
            "chunk_count": chunk_count,
        }
    except Exception as exc:
        logger.exception(
            "Failed to ingest knowledge document %s into ChromaDB",
            document.get("_id"),
        )
        settings = get_settings()
        detail = (
            f"ChromaDB ingestion failed ({settings.chroma_mode}). "
            "Document was saved but embeddings were not updated."
        )
        return {
            "ingestion_status": "failed",
            "ingestion_error": detail,
            "ingested_at": None,
            "chunk_count": 0,
            "_exception": str(exc),
        }
