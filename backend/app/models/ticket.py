"""Ticket document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.models.workspace import apply_optional_workspace_id


TICKETS_COLLECTION = "tickets"

TICKET_STATUSES = (
    "OPEN",
    "IN_PROGRESS",
    "PENDING",
    "RESOLVED",
    "CLOSED",
)

TICKET_PRIORITIES = (
    "LOW",
    "MEDIUM",
    "HIGH",
    "URGENT",
)

TICKET_RESOLVED_STATUSES = (
    "RESOLVED",
    "CLOSED",
)

CONVERSATION_OPEN_STATUSES = (
    "Open",
    "Waiting",
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def normalize_optional_conversation_id(conversation_id: str | None) -> str | None:
    """Return a stripped conversation id, or None when missing or blank."""
    if conversation_id is None:
        return None
    cleaned = str(conversation_id).strip()
    return cleaned or None


def apply_optional_conversation_id(
    document: dict[str, Any],
    conversation_id: str | None,
) -> dict[str, Any]:
    """Attach conversation_id only when a non-empty value is provided."""
    cleaned = normalize_optional_conversation_id(conversation_id)
    if cleaned is not None:
        document["conversation_id"] = cleaned
    return document


def normalize_optional_resolution_note(resolution_note: str | None) -> str | None:
    """Return a stripped resolution note, or None when missing or blank."""
    if resolution_note is None:
        return None
    cleaned = str(resolution_note).strip()
    return cleaned or None


def apply_optional_resolution_metadata(
    document: dict[str, Any],
    *,
    resolved_at: datetime | None = None,
    resolution_note: str | None = None,
) -> dict[str, Any]:
    """Attach resolution fields only when they have values. Do not invent history."""
    if resolved_at is not None:
        document["resolved_at"] = resolved_at
    cleaned_note = normalize_optional_resolution_note(resolution_note)
    if cleaned_note is not None:
        document["resolution_note"] = cleaned_note
    return document


def conversation_needs_resolution(
    ticket_status: str,
    conversation_status: str | None,
) -> bool | None:
    """True when a resolved/closed ticket still has an open linked conversation."""
    if conversation_status is None:
        return None
    return (
        ticket_status in TICKET_RESOLVED_STATUSES
        and conversation_status in CONVERSATION_OPEN_STATUSES
    )


def build_ticket_document(
    *,
    owner_id: str,
    customer_id: str,
    title: str,
    description: str,
    status: str = "OPEN",
    priority: str = "MEDIUM",
    assignee_id: str | None = None,
    workspace_id: str | None = None,
    conversation_id: str | None = None,
    resolved_at: datetime | None = None,
    resolution_note: str | None = None,
) -> dict[str, Any]:
    """Create a new ticket document ready for insertion."""
    now = utc_now()
    document = {
        "_id": str(uuid4()),
        "owner_id": owner_id,
        "customer_id": customer_id,
        "title": title.strip(),
        "description": description.strip(),
        "status": status,
        "priority": priority,
        "assignee_id": assignee_id,
        "created_at": now,
        "updated_at": now,
    }
    apply_optional_workspace_id(document, workspace_id)
    apply_optional_conversation_id(document, conversation_id)
    return apply_optional_resolution_metadata(
        document,
        resolved_at=resolved_at,
        resolution_note=resolution_note,
    )


def serialize_ticket(
    document: dict[str, Any],
    *,
    customer: dict[str, Any] | None = None,
    assignee: dict[str, Any] | None = None,
    conversation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Map a MongoDB ticket document to a public payload."""
    conversation_status = conversation.get("status") if conversation else None
    payload = {
        "id": str(document["_id"]),
        "owner_id": document["owner_id"],
        "customer_id": document.get("customer_id"),
        "conversation_id": normalize_optional_conversation_id(
            document.get("conversation_id"),
        ),
        "title": document["title"],
        "description": document["description"],
        "status": document["status"],
        "priority": document["priority"],
        "assignee_id": document.get("assignee_id"),
        "resolved_at": document.get("resolved_at"),
        "resolution_note": document.get("resolution_note"),
        "conversation_status": conversation_status,
        "conversation_assigned_agent_id": (
            conversation.get("assigned_agent_id") if conversation else None
        ),
        "conversation_needs_resolution": conversation_needs_resolution(
            document["status"],
            conversation_status,
        ),
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
        "customer": customer,
        "assignee": assignee,
    }
    workspace_id = document.get("workspace_id")
    if workspace_id:
        payload["workspace_id"] = str(workspace_id)
    return payload
