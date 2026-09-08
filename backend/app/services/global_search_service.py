"""Workspace-scoped global search across support resources."""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status

# Prefer the non-deprecated constant when available.
try:
    _UNPROCESSABLE = status.HTTP_422_UNPROCESSABLE_CONTENT  # type: ignore[attr-defined]
except AttributeError:
    _UNPROCESSABLE = 422
from pymongo.errors import PyMongoError

from app.core.logging import get_logger
from app.database.mongodb import get_database
from app.models.conversation import CONVERSATIONS_COLLECTION
from app.models.customer import CUSTOMERS_COLLECTION
from app.models.knowledge import KNOWLEDGE_DOCUMENTS_COLLECTION
from app.models.message import MESSAGES_COLLECTION
from app.models.ticket import TICKETS_COLLECTION
from app.schemas.search import GlobalSearchHit, GlobalSearchResponse

logger = get_logger(__name__)

_REGEX_SPECIAL = re.compile(r"[.^$*+?{}\[\]\\|()]")

MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 200
DEFAULT_PER_TYPE_LIMIT = 5
MAX_PER_TYPE_LIMIT = 10

EMPTY_QUERY_DETAIL = "Search query must not be empty."
QUERY_TOO_SHORT_DETAIL = (
    f"Search query must be at least {MIN_QUERY_LENGTH} characters."
)


def _get_collection(name: str):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc
    return db[name]


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


def _escape_search(term: str) -> str:
    return _REGEX_SPECIAL.sub(lambda match: "\\" + match.group(0), term)


def normalize_search_query(raw: str | None) -> str:
    """Trim and validate a global search query. Raises HTTPException on invalid."""
    cleaned = (raw or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=_UNPROCESSABLE,
            detail=EMPTY_QUERY_DETAIL,
        )
    if len(cleaned) < MIN_QUERY_LENGTH:
        raise HTTPException(
            status_code=_UNPROCESSABLE,
            detail=QUERY_TOO_SHORT_DETAIL,
        )
    if len(cleaned) > MAX_QUERY_LENGTH:
        cleaned = cleaned[:MAX_QUERY_LENGTH]
    return cleaned


def normalize_per_type_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_PER_TYPE_LIMIT
    try:
        value = int(limit)
    except (TypeError, ValueError):
        return DEFAULT_PER_TYPE_LIMIT
    return max(1, min(value, MAX_PER_TYPE_LIMIT))


def _token_and_or_clauses(
    cleaned: str,
    fields: list[str],
) -> dict[str, Any]:
    tokens = [token for token in cleaned.split() if token]
    clauses: list[dict[str, Any]] = []
    for token in tokens:
        pattern = _escape_search(token)
        clauses.append(
            {
                "$or": [
                    {field: {"$regex": pattern, "$options": "i"}}
                    for field in fields
                ],
            },
        )
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _require_workspace_id(workspace_id: str) -> str:
    cleaned = (workspace_id or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid workspace id.",
        )
    return cleaned


async def _search_customers(
    workspace_id: str,
    query: str,
    limit: int,
) -> list[GlobalSearchHit]:
    filters: dict[str, Any] = {
        "workspace_id": workspace_id,
        **_token_and_or_clauses(
            query,
            ["first_name", "last_name", "email", "company"],
        ),
    }
    try:
        cursor = (
            _get_collection(CUSTOMERS_COLLECTION)
            .find(filters)
            .sort("updated_at", -1)
            .limit(limit)
        )
        documents = await cursor.to_list(length=limit)
    except PyMongoError as exc:
        raise _db_error("search customers", exc) from exc

    hits: list[GlobalSearchHit] = []
    for doc in documents:
        customer_id = str(doc["_id"])
        name = f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip()
        email = str(doc.get("email") or "")
        company = str(doc.get("company") or "").strip()
        subtitle_parts = [part for part in (email, company) if part]
        hits.append(
            GlobalSearchHit(
                id=customer_id,
                type="customer",
                title=name or email or "Customer",
                subtitle=" · ".join(subtitle_parts) or None,
                href=f"/dashboard/customers?customer={customer_id}",
            ),
        )
    return hits


async def _search_tickets(
    workspace_id: str,
    query: str,
    limit: int,
) -> list[GlobalSearchHit]:
    filters: dict[str, Any] = {
        "workspace_id": workspace_id,
        **_token_and_or_clauses(query, ["title", "description"]),
    }
    try:
        cursor = (
            _get_collection(TICKETS_COLLECTION)
            .find(filters)
            .sort("updated_at", -1)
            .limit(limit)
        )
        documents = await cursor.to_list(length=limit)
    except PyMongoError as exc:
        raise _db_error("search tickets", exc) from exc

    hits: list[GlobalSearchHit] = []
    for doc in documents:
        ticket_id = str(doc["_id"])
        status_value = str(doc.get("status") or "")
        priority = str(doc.get("priority") or "")
        subtitle = " · ".join(part for part in (status_value, priority) if part)
        hits.append(
            GlobalSearchHit(
                id=ticket_id,
                type="ticket",
                title=str(doc.get("title") or "Ticket"),
                subtitle=subtitle or None,
                href=f"/dashboard/tickets?ticket={ticket_id}",
            ),
        )
    return hits


async def _conversation_ids_from_messages(
    workspace_id: str,
    query: str,
    limit: int,
) -> list[str]:
    """Find conversation ids via message content, scoped to this workspace."""
    text_clause = _token_and_or_clauses(query, ["content"])
    # Prefer messages already tagged with workspace_id.
    filters: dict[str, Any] = {
        "workspace_id": workspace_id,
        **text_clause,
    }
    try:
        cursor = (
            _get_collection(MESSAGES_COLLECTION)
            .find(filters, {"conversation_id": 1})
            .sort("created_at", -1)
            .limit(limit * 3)
        )
        documents = await cursor.to_list(length=limit * 3)
    except PyMongoError as exc:
        raise _db_error("search messages", exc) from exc

    ids: list[str] = []
    seen: set[str] = set()
    for doc in documents:
        conversation_id = str(doc.get("conversation_id") or "").strip()
        if conversation_id and conversation_id not in seen:
            seen.add(conversation_id)
            ids.append(conversation_id)
        if len(ids) >= limit:
            break

    if ids:
        return ids

    # Legacy messages may lack workspace_id: match content, then intersect
    # with conversations that belong to this workspace.
    try:
        cursor = (
            _get_collection(MESSAGES_COLLECTION)
            .find(text_clause, {"conversation_id": 1})
            .sort("created_at", -1)
            .limit(limit * 5)
        )
        candidates = await cursor.to_list(length=limit * 5)
    except PyMongoError as exc:
        raise _db_error("search legacy messages", exc) from exc

    candidate_ids = [
        str(doc.get("conversation_id") or "").strip()
        for doc in candidates
        if doc.get("conversation_id")
    ]
    candidate_ids = [cid for cid in candidate_ids if cid]
    if not candidate_ids:
        return []

    try:
        scoped = await (
            _get_collection(CONVERSATIONS_COLLECTION)
            .find(
                {
                    "workspace_id": workspace_id,
                    "_id": {"$in": candidate_ids},
                },
                {"_id": 1},
            )
            .to_list(length=limit)
        )
    except PyMongoError as exc:
        raise _db_error("scope message conversations", exc) from exc

    return [str(doc["_id"]) for doc in scoped]


async def _search_conversations(
    workspace_id: str,
    query: str,
    limit: int,
) -> list[GlobalSearchHit]:
    field_clause = _token_and_or_clauses(
        query,
        ["subject", "customer_name", "customer_email", "last_message"],
    )
    message_ids = await _conversation_ids_from_messages(
        workspace_id,
        query,
        limit,
    )
    or_branches: list[dict[str, Any]] = [field_clause]
    if message_ids:
        or_branches.append({"_id": {"$in": message_ids}})

    filters: dict[str, Any] = {
        "workspace_id": workspace_id,
        "$or": or_branches,
    }
    try:
        cursor = (
            _get_collection(CONVERSATIONS_COLLECTION)
            .find(filters)
            .sort("updated_at", -1)
            .limit(limit)
        )
        documents = await cursor.to_list(length=limit)
    except PyMongoError as exc:
        raise _db_error("search conversations", exc) from exc

    hits: list[GlobalSearchHit] = []
    for doc in documents:
        conversation_id = str(doc["_id"])
        customer_name = str(doc.get("customer_name") or "").strip()
        status_value = str(doc.get("status") or "")
        channel = str(doc.get("channel") or "")
        subtitle = " · ".join(
            part for part in (customer_name, status_value, channel) if part
        )
        hits.append(
            GlobalSearchHit(
                id=conversation_id,
                type="conversation",
                title=str(doc.get("subject") or "Conversation"),
                subtitle=subtitle or None,
                href=(
                    f"/dashboard/conversations?conversation={conversation_id}"
                ),
            ),
        )
    return hits


async def _search_knowledge(
    workspace_id: str,
    query: str,
    limit: int,
) -> list[GlobalSearchHit]:
    filters: dict[str, Any] = {
        "workspace_id": workspace_id,
        **_token_and_or_clauses(query, ["title", "content", "tags", "source"]),
    }
    try:
        cursor = (
            _get_collection(KNOWLEDGE_DOCUMENTS_COLLECTION)
            .find(filters)
            .sort("updated_at", -1)
            .limit(limit)
        )
        documents = await cursor.to_list(length=limit)
    except PyMongoError as exc:
        raise _db_error("search knowledge", exc) from exc

    hits: list[GlobalSearchHit] = []
    for doc in documents:
        document_id = str(doc["_id"])
        status_value = str(doc.get("status") or "")
        tags = [str(tag) for tag in (doc.get("tags") or []) if tag]
        tag_preview = ", ".join(tags[:3])
        subtitle = " · ".join(
            part for part in (status_value, tag_preview) if part
        )
        hits.append(
            GlobalSearchHit(
                id=document_id,
                type="knowledge",
                title=str(doc.get("title") or "Knowledge document"),
                subtitle=subtitle or None,
                href=f"/dashboard/knowledge-base?document={document_id}",
            ),
        )
    return hits


async def global_search(
    *,
    workspace_id: str,
    query: str,
    per_type_limit: int | None = None,
) -> GlobalSearchResponse:
    """
    Search conversations, tickets, customers, and knowledge in one workspace.

    Tenant boundary is always ``workspace_id`` from the authenticated context.
    """
    workspace_id = _require_workspace_id(workspace_id)
    cleaned = normalize_search_query(query)
    limit = normalize_per_type_limit(per_type_limit)

    conversations = await _search_conversations(workspace_id, cleaned, limit)
    tickets = await _search_tickets(workspace_id, cleaned, limit)
    customers = await _search_customers(workspace_id, cleaned, limit)
    knowledge = await _search_knowledge(workspace_id, cleaned, limit)

    return GlobalSearchResponse(
        query=cleaned,
        conversations=conversations,
        tickets=tickets,
        customers=customers,
        knowledge=knowledge,
    )
