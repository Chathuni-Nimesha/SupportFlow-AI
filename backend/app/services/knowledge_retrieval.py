"""Knowledge retrieval via ChromaDB similarity search."""

from __future__ import annotations

import asyncio
from typing import Any

from app.core.logging import get_logger
from app.database.chroma import get_knowledge_collection

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
    owner_id: str,
    query: str,
    top_k: int,
) -> list[dict[str, Any]]:
    collection = get_knowledge_collection()
    raw = collection.query(
        query_texts=[query],
        n_results=top_k,
        where={
            "$and": [
                {"owner_id": owner_id},
                {"status": PUBLISHED_STATUS},
            ],
        },
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
    owner_id: str,
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list[dict[str, Any]]:
    """
    Retrieve owner-scoped published knowledge chunks for a query.

    Uses the same Chroma collection and embedding function as ingestion.
    Returns an empty list when the query is blank or no matches exist.
    """
    cleaned_owner = (owner_id or "").strip()
    cleaned_query = (query or "").strip()
    if not cleaned_owner or not cleaned_query:
        return []

    safe_top_k = normalize_top_k(top_k)

    try:
        return await asyncio.to_thread(
            _query_knowledge_sync,
            owner_id=cleaned_owner,
            query=cleaned_query,
            top_k=safe_top_k,
        )
    except Exception:
        logger.exception(
            "Knowledge retrieval failed for owner_id=%s",
            cleaned_owner,
        )
        raise
