"""Ticket directory business logic."""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import PyMongoError

from app.core.logging import get_logger
from app.core.pagination import paginate_find, paginated_payload
from app.database.mongodb import get_database
from app.models.conversation import CONVERSATIONS_COLLECTION
from app.models.customer import CUSTOMERS_COLLECTION
from app.models.ticket import (
    TICKET_PRIORITIES,
    TICKET_STATUSES,
    TICKETS_COLLECTION,
    build_ticket_document,
    serialize_ticket,
    utc_now,
)
from app.schemas.ticket import (
    TicketCreateRequest,
    TicketResponse,
    TicketUpdateRequest,
)
from app.services import team_service

logger = get_logger(__name__)

TICKET_CONVERSATION_CUSTOMER_MISMATCH = (
    "Ticket customer does not match the linked conversation's customer."
)
INVALID_TICKET_STATUS = (
    f"Invalid status. Must be one of: {', '.join(TICKET_STATUSES)}."
)
INVALID_TICKET_PRIORITY = (
    f"Invalid priority. Must be one of: {', '.join(TICKET_PRIORITIES)}."
)

_REGEX_SPECIAL = re.compile(r"[.^$*+?{}\[\]\\|()]")


def _get_collection(name: str):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc
    return db[name]


def _tickets():
    return _get_collection(TICKETS_COLLECTION)


def _customers():
    return _get_collection(CUSTOMERS_COLLECTION)


def _conversations():
    return _get_collection(CONVERSATIONS_COLLECTION)


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


def _escape_search(term: str) -> str:
    return _REGEX_SPECIAL.sub(lambda match: "\\" + match.group(0), term)


def _title_description_search(cleaned: str) -> dict[str, Any]:
    tokens = [token for token in cleaned.split() if token]
    clauses = []
    for token in tokens:
        pattern = _escape_search(token)
        clauses.append(
            {
                "$or": [
                    {"title": {"$regex": pattern, "$options": "i"}},
                    {"description": {"$regex": pattern, "$options": "i"}},
                ]
            }
        )
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _require_id(value: str, label: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}.",
        )
    return cleaned


def _ticket_filter(ticket_id: str, workspace_id: str) -> dict[str, str]:
    return {"_id": ticket_id, "workspace_id": workspace_id}


def _optional_id(value: Any) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def _ensure_ticket_status(value: str) -> str:
    if value not in TICKET_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_TICKET_STATUS,
        )
    return value


def _ensure_ticket_priority(value: str) -> str:
    if value not in TICKET_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_TICKET_PRIORITY,
        )
    return value


def _ensure_matching_conversation_customer(
    ticket_customer_id: str,
    conversation: dict[str, Any],
) -> None:
    conversation_customer_id = _optional_id(conversation.get("customer_id"))
    if conversation_customer_id is None:
        return
    if conversation_customer_id != ticket_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=TICKET_CONVERSATION_CUSTOMER_MISMATCH,
        )


def _customer_summary(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "first_name": document["first_name"],
        "last_name": document["last_name"],
        "email": document["email"],
    }


async def _get_workspace_customer(
    customer_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    customer_id = _require_id(customer_id, "customer id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _customers().find_one(
            {"_id": customer_id, "workspace_id": workspace_id},
        )
    except PyMongoError as exc:
        raise _db_error("fetch customer for ticket", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return document


async def _get_workspace_conversation(
    conversation_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    conversation_id = _require_id(conversation_id, "conversation id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _conversations().find_one(
            {"_id": conversation_id, "workspace_id": workspace_id},
        )
    except PyMongoError as exc:
        raise _db_error("fetch conversation for ticket", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return document


async def _get_workspace_ticket(
    ticket_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    ticket_id = _require_id(ticket_id, "ticket id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _tickets().find_one(
            _ticket_filter(ticket_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("fetch ticket", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )
    return document


async def _customer_summaries(
    workspace_id: str,
    customer_ids: list[str],
) -> dict[str, dict[str, Any]]:
    unique_ids = [cid for cid in dict.fromkeys(customer_ids) if cid]
    if not unique_ids:
        return {}

    try:
        cursor = _customers().find(
            {"_id": {"$in": unique_ids}, "workspace_id": workspace_id},
        )
        documents = await cursor.to_list(length=len(unique_ids))
    except PyMongoError as exc:
        raise _db_error("fetch ticket customers", exc) from exc

    return {str(doc["_id"]): _customer_summary(doc) for doc in documents}


def _to_response(
    document: dict[str, Any],
    customers: dict[str, dict[str, Any]],
    assignees: dict[str, dict[str, Any]] | None = None,
) -> TicketResponse:
    customer_id = document.get("customer_id")
    assignee_id = document.get("assignee_id")
    assignee_map = assignees or {}
    return TicketResponse.model_validate(
        serialize_ticket(
            document,
            customer=customers.get(customer_id) if customer_id else None,
            assignee=assignee_map.get(assignee_id) if assignee_id else None,
        ),
    )


async def list_tickets(
    workspace_id: str,
    *,
    owner_id: str,
    query: str | None = None,
    status_filter: str | None = None,
    priority_filter: str | None = None,
    assignee_id: str | None = None,
    unassigned: bool = False,
    customer_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    workspace_id = _require_id(workspace_id, "workspace id")
    if unassigned and assignee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use either assignee_id or unassigned, not both.",
        )

    # Tenancy is workspace_id only. owner_id is used later for assignee
    # summaries / OWNER repair, never as a tenant filter.
    filters: dict[str, Any] = {"workspace_id": workspace_id}
    if status_filter:
        filters["status"] = status_filter
    if priority_filter:
        filters["priority"] = priority_filter
    if customer_id:
        filters["customer_id"] = customer_id
    if unassigned:
        filters["assignee_id"] = None
    elif assignee_id:
        filters["assignee_id"] = assignee_id

    cleaned = (query or "").strip()
    if cleaned:
        filters.update(_title_description_search(cleaned))

    try:
        documents, total = await paginate_find(
            _tickets(),
            filters,
            page=page,
            page_size=page_size,
        )
    except PyMongoError as exc:
        raise _db_error("list tickets", exc) from exc

    customers = await _customer_summaries(
        workspace_id,
        [doc.get("customer_id") for doc in documents],
    )
    assignees = await team_service.member_summaries(
        workspace_id,
        [doc.get("assignee_id") for doc in documents if doc.get("assignee_id")],
        owner_id=owner_id,
    )
    items = [_to_response(doc, customers, assignees) for doc in documents]
    return paginated_payload(
        items,
        page=page,
        page_size=page_size,
        total=total,
    )


async def get_ticket(
    ticket_id: str,
    workspace_id: str,
    *,
    owner_id: str,
) -> TicketResponse:
    document = await _get_workspace_ticket(ticket_id, workspace_id)
    customers = await _customer_summaries(
        workspace_id,
        [document.get("customer_id")],
    )
    assignees = await team_service.member_summaries(
        workspace_id,
        [document["assignee_id"]] if document.get("assignee_id") else [],
        owner_id=owner_id,
    )
    return _to_response(document, customers, assignees)


async def create_ticket(
    *,
    workspace_id: str,
    owner_id: str,
    payload: TicketCreateRequest,
) -> TicketResponse:
    workspace_id = _require_id(workspace_id, "workspace id")
    status_value = _ensure_ticket_status(payload.status)
    priority_value = _ensure_ticket_priority(payload.priority)
    customer = await _get_workspace_customer(payload.customer_id, workspace_id)
    conversation_id = None
    if payload.conversation_id:
        conversation = await _get_workspace_conversation(
            payload.conversation_id,
            workspace_id,
        )
        _ensure_matching_conversation_customer(
            str(customer["_id"]),
            conversation,
        )
        conversation_id = str(conversation["_id"])
    assignee_id = await team_service.require_assignable_member(
        payload.assignee_id,
        workspace_id,
        owner_id=owner_id,
    )

    document = build_ticket_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customer_id=str(customer["_id"]),
        conversation_id=conversation_id,
        title=payload.title,
        description=payload.description,
        status=status_value,
        priority=priority_value,
        assignee_id=assignee_id,
    )

    try:
        await _tickets().insert_one(document)
    except PyMongoError as exc:
        raise _db_error("create ticket", exc) from exc

    assignees = await team_service.member_summaries(
        workspace_id,
        [assignee_id] if assignee_id else [],
        owner_id=owner_id,
    )
    return _to_response(
        document,
        {str(customer["_id"]): _customer_summary(customer)},
        assignees,
    )


async def _validated_ticket_updates(
    *,
    existing: dict[str, Any],
    payload: TicketUpdateRequest,
    workspace_id: str,
    owner_id: str,
) -> tuple[dict[str, Any], dict[str, str]]:
    """Resolve PATCH fields. Raises before the caller writes anything."""
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("workspace_id", None)
    updates.pop("owner_id", None)

    if "status" in updates:
        updates["status"] = _ensure_ticket_status(updates["status"])
    if "priority" in updates:
        updates["priority"] = _ensure_ticket_priority(updates["priority"])

    if "assignee_id" in updates:
        updates["assignee_id"] = await team_service.require_assignable_member(
            updates["assignee_id"],
            workspace_id,
            owner_id=owner_id,
        )

    customer_id_in_request = "customer_id" in updates
    if customer_id_in_request and updates["customer_id"] is None:
        # Tickets require a customer. Null does not unlink.
        updates.pop("customer_id")
        customer_id_in_request = False
    elif customer_id_in_request:
        customer = await _get_workspace_customer(updates["customer_id"], workspace_id)
        updates["customer_id"] = str(customer["_id"])

    unset_fields: dict[str, str] = {}
    conversation_id_in_request = "conversation_id" in updates
    if conversation_id_in_request:
        requested_conversation_id = updates.pop("conversation_id")
        if requested_conversation_id is None:
            unset_fields["conversation_id"] = ""
        else:
            conversation = await _get_workspace_conversation(
                requested_conversation_id,
                workspace_id,
            )
            updates["conversation_id"] = str(conversation["_id"])

    if customer_id_in_request or conversation_id_in_request:
        resulting_customer_id = _optional_id(
            updates.get("customer_id", existing.get("customer_id")),
        )
        if "conversation_id" in unset_fields:
            resulting_conversation_id = None
        elif "conversation_id" in updates:
            resulting_conversation_id = _optional_id(updates.get("conversation_id"))
        else:
            resulting_conversation_id = _optional_id(existing.get("conversation_id"))
        if resulting_customer_id and resulting_conversation_id:
            conversation = await _get_workspace_conversation(
                resulting_conversation_id,
                workspace_id,
            )
            _ensure_matching_conversation_customer(
                resulting_customer_id,
                conversation,
            )

    return updates, unset_fields


async def update_ticket(
    ticket_id: str,
    workspace_id: str,
    payload: TicketUpdateRequest,
    *,
    owner_id: str,
) -> TicketResponse:
    existing = await _get_workspace_ticket(ticket_id, workspace_id)
    ticket_id = _require_id(ticket_id, "ticket id")
    workspace_id = _require_id(workspace_id, "workspace id")

    updates, unset_fields = await _validated_ticket_updates(
        existing=existing,
        payload=payload,
        workspace_id=workspace_id,
        owner_id=owner_id,
    )

    if not updates and not unset_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    updates["updated_at"] = utc_now()
    operations: dict[str, Any] = {"$set": updates}
    if unset_fields:
        operations["$unset"] = unset_fields
    tenant_filter = _ticket_filter(ticket_id, workspace_id)

    try:
        await _tickets().update_one(
            tenant_filter,
            operations,
        )
        document = await _tickets().find_one(tenant_filter)
    except PyMongoError as exc:
        raise _db_error("update ticket", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    customers = await _customer_summaries(
        workspace_id,
        [document.get("customer_id")],
    )
    assignees = await team_service.member_summaries(
        workspace_id,
        [document["assignee_id"]] if document.get("assignee_id") else [],
        owner_id=owner_id,
    )
    return _to_response(document, customers, assignees)


async def delete_ticket(ticket_id: str, workspace_id: str) -> None:
    await _get_workspace_ticket(ticket_id, workspace_id)
    ticket_id = _require_id(ticket_id, "ticket id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        result = await _tickets().delete_one(
            _ticket_filter(ticket_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("delete ticket", exc) from exc

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )
