"""Knowledge document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.models.workspace import apply_optional_workspace_id


KNOWLEDGE_DOCUMENTS_COLLECTION = "knowledge_documents"
KNOWLEDGE_VECTORS_COLLECTION = "knowledge_vectors"

KNOWLEDGE_STATUSES = ("Draft", "Published")
KNOWLEDGE_SOURCE_TYPES = ("manual", "url", "file")
KNOWLEDGE_INGESTION_STATUSES = (
    "pending",
    "indexed",
    "failed",
    "not_indexed",
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def build_knowledge_document(
    *,
    owner_id: str,
    title: str,
    content: str,
    source_type: str = "manual",
    source: str | None = None,
    status: str = "Draft",
    tags: list[str] | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Create a new knowledge document ready for insertion."""
    now = utc_now()
    cleaned_tags = [
        tag.strip() for tag in (tags or []) if isinstance(tag, str) and tag.strip()
    ]
    document = {
        "_id": str(uuid4()),
        "owner_id": owner_id,
        "title": title.strip(),
        "content": content.strip(),
        "source_type": source_type,
        "source": source.strip() if source else None,
        "status": status,
        "tags": cleaned_tags,
        "ingestion_status": "pending" if status == "Published" else "not_indexed",
        "ingestion_error": None,
        "ingested_at": None,
        "chunk_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    return apply_optional_workspace_id(document, workspace_id)


def serialize_knowledge_document(document: dict[str, Any]) -> dict[str, Any]:
    """Map a MongoDB knowledge document to a public payload."""
    payload = {
        "id": str(document["_id"]),
        "owner_id": document["owner_id"],
        "title": document["title"],
        "content": document["content"],
        "source_type": document.get("source_type", "manual"),
        "source": document.get("source"),
        "status": document["status"],
        "tags": list(document.get("tags") or []),
        "ingestion_status": document.get("ingestion_status") or "not_indexed",
        "ingestion_error": document.get("ingestion_error"),
        "ingested_at": document.get("ingested_at"),
        "chunk_count": int(document.get("chunk_count") or 0),
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }
    workspace_id = document.get("workspace_id")
    if workspace_id:
        payload["workspace_id"] = str(workspace_id)
    return payload
