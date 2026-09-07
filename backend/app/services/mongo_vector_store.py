"""MongoDB Atlas Vector Search store for published knowledge chunks."""

from __future__ import annotations

from typing import Any

from app.config.settings import get_settings
from app.core.logging import get_logger
from app.database.mongodb import get_database
from app.models.knowledge import KNOWLEDGE_VECTORS_COLLECTION
from app.services.gemini_embeddings import embed_query, embed_texts

logger = get_logger(__name__)

DEFAULT_VECTOR_INDEX = "knowledge_vectors_index"
PUBLISHED_STATUS = "Published"


def knowledge_vectors_collection():
    settings = get_settings()
    name = (settings.mongo_vector_collection or "").strip() or KNOWLEDGE_VECTORS_COLLECTION
    return get_database()[name]


def mongo_published_workspace_filter(workspace_id: str) -> dict[str, str]:
    """Atlas $vectorSearch pre-filter: current workspace AND published only."""
    return {
        "workspace_id": workspace_id,
        "status": PUBLISHED_STATUS,
    }


def _vector_index_name() -> str:
    settings = get_settings()
    return (settings.mongo_vector_index or "").strip() or DEFAULT_VECTOR_INDEX


def _metadata_from_vector_document(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "document_id": str(document.get("knowledge_document_id") or ""),
        "owner_id": str(document.get("owner_id") or ""),
        "workspace_id": str(document.get("workspace_id") or ""),
        "title": str(document.get("title") or ""),
        "status": str(document.get("status") or ""),
        "source_type": str(document.get("source_type") or "manual"),
        "source": str(document.get("source") or ""),
        "tags": str(document.get("tags") or ""),
        "chunk_index": document.get("chunk_index"),
        "chunk_count": document.get("chunk_count"),
    }


async def delete_document_vectors(
    document_id: str,
    workspace_id: str | None = None,
) -> int:
    """Delete vector chunks for one knowledge document, scoped by workspace when known."""
    cleaned_document = str(document_id or "").strip()
    if not cleaned_document:
        return 0

    query: dict[str, Any] = {"knowledge_document_id": cleaned_document}
    cleaned_workspace = str(workspace_id or "").strip()
    if cleaned_workspace:
        query["workspace_id"] = cleaned_workspace

    result = await knowledge_vectors_collection().delete_many(query)
    return int(getattr(result, "deleted_count", 0) or 0)


async def upsert_document_vectors(document: dict[str, Any]) -> int:
    """Replace Mongo vector chunks for a published knowledge document."""
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

    from app.services.knowledge_ingestion import build_chunk_id, chunk_text

    chunks = chunk_text(f"{title}\n\n{content}")
    await delete_document_vectors(document_id, workspace_id)
    if not chunks:
        return 0

    embeddings = await embed_texts(chunks)
    rows: list[dict[str, Any]] = []
    tag_text = ",".join(str(tag) for tag in tags)[:500]
    source_text = str(source)[:500] if source else ""
    for index, chunk in enumerate(chunks):
        chunk_id = build_chunk_id(document_id, index)
        rows.append(
            {
                "_id": chunk_id,
                "workspace_id": workspace_id,
                "knowledge_document_id": document_id,
                "chunk_id": chunk_id,
                "content": chunk,
                "embedding": embeddings[index],
                "status": status,
                "owner_id": owner_id,
                "title": title[:300],
                "source_type": source_type,
                "source": source_text,
                "tags": tag_text,
                "chunk_index": index,
                "chunk_count": len(chunks),
            }
        )

    await knowledge_vectors_collection().insert_many(rows)
    return len(rows)


async def query_published_vectors(
    *,
    workspace_id: str,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    """
    Retrieve published chunks for the current workspace via Atlas $vectorSearch.

    Tenant isolation is applied inside ``$vectorSearch.filter``, not after an
    unscoped search. Hits that do not match workspace + Published are dropped.
    """
    query_vector = await embed_query(query)
    search_filter = mongo_published_workspace_filter(workspace_id)
    pipeline = [
        {
            "$vectorSearch": {
                "index": _vector_index_name(),
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": max(top_k * 20, 40),
                "limit": top_k,
                "filter": search_filter,
            }
        },
        {
            "$project": {
                "_id": 1,
                "content": 1,
                "workspace_id": 1,
                "knowledge_document_id": 1,
                "chunk_id": 1,
                "status": 1,
                "owner_id": 1,
                "title": 1,
                "source": 1,
                "source_type": 1,
                "tags": 1,
                "chunk_index": 1,
                "chunk_count": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    results: list[dict[str, Any]] = []
    cursor = knowledge_vectors_collection().aggregate(pipeline)
    async for document in cursor:
        hit_workspace = str(document.get("workspace_id") or "").strip()
        hit_status = str(document.get("status") or "").strip()
        if hit_workspace != workspace_id or hit_status != PUBLISHED_STATUS:
            continue

        score_raw = document.get("score")
        try:
            score = float(score_raw) if score_raw is not None else None
        except (TypeError, ValueError):
            score = None
        distance = None if score is None else max(0.0, 1.0 - score)
        chunk_id = str(document.get("chunk_id") or document.get("_id") or "")
        clamped_score = None
        if score is not None:
            clamped_score = max(0.0, min(1.0, score))
        results.append(
            {
                "id": chunk_id,
                "document": str(document.get("content") or ""),
                "metadata": _metadata_from_vector_document(document),
                "distance": distance,
                "score": clamped_score,
            }
        )
    return results
