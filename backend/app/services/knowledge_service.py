"""Knowledge document business logic."""

from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import PyMongoError

from app.core.logging import get_logger
from app.core.pagination import paginate_find, paginated_payload
from app.database.mongodb import get_database
from app.models.knowledge import (
    KNOWLEDGE_DOCUMENTS_COLLECTION,
    build_knowledge_document,
    serialize_knowledge_document,
    utc_now,
)
from app.schemas.knowledge import (
    KnowledgeDocumentCreateRequest,
    KnowledgeDocumentResponse,
    KnowledgeDocumentUpdateRequest,
    KnowledgeIngestionResponse,
)
from app.services import knowledge_ingestion

logger = get_logger(__name__)


def _get_collection(name: str):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc
    return db[name]


def _knowledge_documents():
    return _get_collection(KNOWLEDGE_DOCUMENTS_COLLECTION)


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


def _require_id(value: str, label: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}.",
        )
    return cleaned


def _document_filter(document_id: str, workspace_id: str) -> dict[str, str]:
    return {"_id": document_id, "workspace_id": workspace_id}


def _normalize_tags(tags: list[str] | None) -> list[str]:
    if tags is None:
        return []
    cleaned: list[str] = []
    for tag in tags:
        value = tag.strip()
        if value and value not in cleaned:
            cleaned.append(value)
    return cleaned


async def _get_workspace_document(
    document_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    document_id = _require_id(document_id, "knowledge document id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _knowledge_documents().find_one(
            _document_filter(document_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("fetch knowledge document", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge document not found.",
        )
    return document


async def _persist_ingestion_result(
    document_id: str,
    workspace_id: str,
    result: dict[str, Any],
) -> dict[str, Any]:
    tenant_filter = _document_filter(document_id, workspace_id)
    updates = {
        "ingestion_status": result["ingestion_status"],
        "ingestion_error": result.get("ingestion_error"),
        "ingested_at": result.get("ingested_at"),
        "chunk_count": int(result.get("chunk_count") or 0),
        "updated_at": utc_now(),
    }
    try:
        await _knowledge_documents().update_one(
            tenant_filter,
            {"$set": updates},
        )
        document = await _knowledge_documents().find_one(tenant_filter)
    except PyMongoError as exc:
        raise _db_error("persist ingestion status", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge document not found.",
        )
    return document


async def _sync_embeddings(document: dict[str, Any]) -> dict[str, Any]:
    result = await knowledge_ingestion.ingest_knowledge_document(document)
    result.pop("_exception", None)
    return await _persist_ingestion_result(
        str(document["_id"]),
        str(document["workspace_id"]),
        result,
    )


async def list_knowledge_documents(
    workspace_id: str,
    *,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    workspace_id = _require_id(workspace_id, "workspace id")
    try:
        documents, total = await paginate_find(
            _knowledge_documents(),
            {"workspace_id": workspace_id},
            page=page,
            page_size=page_size,
        )
    except PyMongoError as exc:
        raise _db_error("list knowledge documents", exc) from exc

    items = [
        KnowledgeDocumentResponse.model_validate(
            serialize_knowledge_document(doc),
        )
        for doc in documents
    ]
    return paginated_payload(
        items,
        page=page,
        page_size=page_size,
        total=total,
    )


async def get_knowledge_document(
    document_id: str,
    workspace_id: str,
) -> KnowledgeDocumentResponse:
    document = await _get_workspace_document(document_id, workspace_id)
    return KnowledgeDocumentResponse.model_validate(
        serialize_knowledge_document(document),
    )


async def create_knowledge_document(
    *,
    workspace_id: str,
    owner_id: str,
    payload: KnowledgeDocumentCreateRequest,
) -> KnowledgeDocumentResponse:
    workspace_id = _require_id(workspace_id, "workspace id")
    document = build_knowledge_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        title=payload.title,
        content=payload.content,
        source_type=payload.source_type,
        source=payload.source,
        status=payload.status,
        tags=_normalize_tags(payload.tags),
    )

    try:
        await _knowledge_documents().insert_one(document)
    except PyMongoError as exc:
        raise _db_error("create knowledge document", exc) from exc

    document = await _sync_embeddings(document)
    return KnowledgeDocumentResponse.model_validate(
        serialize_knowledge_document(document),
    )


async def update_knowledge_document(
    document_id: str,
    workspace_id: str,
    payload: KnowledgeDocumentUpdateRequest,
) -> KnowledgeDocumentResponse:
    await _get_workspace_document(document_id, workspace_id)
    document_id = _require_id(document_id, "knowledge document id")
    workspace_id = _require_id(workspace_id, "workspace id")

    updates = payload.model_dump(exclude_unset=True)
    updates.pop("workspace_id", None)
    updates.pop("owner_id", None)
    if "title" in updates and updates["title"] is not None:
        updates["title"] = updates["title"].strip()
    if "content" in updates and updates["content"] is not None:
        updates["content"] = updates["content"].strip()
    if "source" in updates and updates["source"] is not None:
        updates["source"] = updates["source"].strip() or None
    if "tags" in updates:
        updates["tags"] = _normalize_tags(updates["tags"])

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    updates["updated_at"] = utc_now()
    # Content/status changes require re-ingestion.
    updates["ingestion_status"] = "pending"
    tenant_filter = _document_filter(document_id, workspace_id)

    try:
        await _knowledge_documents().update_one(
            tenant_filter,
            {"$set": updates},
        )
        document = await _knowledge_documents().find_one(tenant_filter)
    except PyMongoError as exc:
        raise _db_error("update knowledge document", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge document not found.",
        )

    document = await _sync_embeddings(document)
    return KnowledgeDocumentResponse.model_validate(
        serialize_knowledge_document(document),
    )


async def delete_knowledge_document(
    document_id: str,
    workspace_id: str,
) -> None:
    await _get_workspace_document(document_id, workspace_id)
    document_id = _require_id(document_id, "knowledge document id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        await knowledge_ingestion.remove_document_embeddings(
            document_id,
            workspace_id,
        )
    except Exception:
        logger.exception(
            "Failed to remove Chroma embeddings for document %s",
            document_id,
        )

    try:
        result = await _knowledge_documents().delete_one(
            _document_filter(document_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("delete knowledge document", exc) from exc

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge document not found.",
        )


async def ingest_knowledge_document(
    document_id: str,
    workspace_id: str,
) -> KnowledgeIngestionResponse:
    document = await _get_workspace_document(document_id, workspace_id)
    document = await _sync_embeddings(document)
    serialized = serialize_knowledge_document(document)
    response_doc = KnowledgeDocumentResponse.model_validate(serialized)

    status_value = response_doc.ingestion_status
    if status_value == "indexed":
        message = (
            f"Document embedded successfully ({response_doc.chunk_count} chunks)."
        )
    elif status_value == "not_indexed":
        message = "Document is not published; embeddings were cleared/skipped."
    else:
        message = (
            response_doc.ingestion_error
            or "Document saved but embedding ingestion failed."
        )

    return KnowledgeIngestionResponse(
        document=response_doc,
        ingestion_status=status_value,
        chunk_count=response_doc.chunk_count,
        message=message,
    )
