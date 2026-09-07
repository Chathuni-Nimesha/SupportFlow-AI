"""Knowledge retrieval via ChromaDB similarity search."""

from __future__ import annotations

import asyncio
from typing import Any

from app.config.settings import uses_mongo_vector_store
from app.core.logging import get_logger

logger = get_logger(__name__)

DEFAULT_TOP_K = 5
MIN_TOP_K = 1
MAX_TOP_K = 20

# Must match the status string written by knowledge_ingestion metadata.
PUBLISHED_STATUS = "Published"


def normalize_top_k(top_k: int | None) -> int:
    """Clamp top_k to a safe positive range."""
    if top_k is None:
        return DEFAULT_TOP_K
    try:
        value = int(top_k)
    except (TypeError, ValueError):
        return DEFAULT_TOP_K
    return max(MIN_TOP_K, min(value, MAX_TOP_K))


def chroma_published_workspace_filter(workspace_id: str) -> dict[str, Any]:
    """Chroma 1.x metadata filter: current workspace AND published only."""
    return {
        "$and": [
            {"workspace_id": workspace_id},
            {"status": PUBLISHED_STATUS},
        ],
    }


def distance_to_score(distance: float | None) -> float | None:
    """
    Convert Chroma cosine distance to a similarity-like score.

    For cosine space, smaller distance ≈ closer match.
    score = 1 - distance (clamped to [0, 1] when possible).
    """
    if distance is None:
        return None
    try:
        score = 1.0 - float(distance)
    except (TypeError, ValueError):
        return None
    if score < 0.0:
        return 0.0
    if score > 1.0:
        return 1.0
    return score


def _query_knowledge_sync(
    *,
    workspace_id: str,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    from app.database.chroma import get_knowledge_collection

    collection = get_knowledge_collection()
    raw = collection.query(
        query_texts=[query],
        n_results=top_k,
        where=chroma_published_workspace_filter(workspace_id),
        include=["documents", "metadatas", "distances"],
    )

    ids = (raw.get("ids") or [[]])[0] or []
    documents = (raw.get("documents") or [[]])[0] or []
    metadatas = (raw.get("metadatas") or [[]])[0] or []
    distances = (raw.get("distances") or [[]])[0] or []

    results: list[dict[str, Any]] = []
    for index, chunk_id in enumerate(ids):
        document = documents[index] if index < len(documents) else None
        metadata = metadatas[index] if index < len(metadatas) else {}
        distance = distances[index] if index < len(distances) else None
        if isinstance(metadata, dict):
            meta = dict(metadata)
        else:
            meta = {}

        results.append(
            {
                "id": chunk_id,
                "document": document or "",
                "metadata": meta,
                "distance": distance,
                "score": distance_to_score(distance),
            },
        )
    return results


async def retrieve_knowledge(
    workspace_id: str,
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list[dict[str, Any]]:
    """
    Retrieve workspace-scoped published knowledge chunks for a query.

    Tenant isolation is applied in the vector-store filter. Results are
    not post-filtered after an unscoped search.

    Uses the same store and embedding path as ingestion.
    Returns an empty list when the query is blank or no matches exist.
    """
    cleaned_workspace = (workspace_id or "").strip()
    cleaned_query = (query or "").strip()
    if not cleaned_workspace or not cleaned_query:
        return []

    safe_top_k = normalize_top_k(top_k)

    try:
        if uses_mongo_vector_store():
            from app.services.mongo_vector_store import query_published_vectors

            return await query_published_vectors(
                workspace_id=cleaned_workspace,
                query=cleaned_query,
                top_k=safe_top_k,
            )
        return await asyncio.to_thread(
            _query_knowledge_sync,
            workspace_id=cleaned_workspace,
            query=cleaned_query,
            top_k=safe_top_k,
        )
    except Exception:
        logger.exception(
            "Knowledge retrieval failed for workspace_id=%s",
            cleaned_workspace,
        )
        raise
