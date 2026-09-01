"""Ticket document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


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


def utc_now() -> datetime:
    return datetime.now(UTC)


def build_ticket_document(
    *,
    owner_id: str,
    customer_id: str,
    title: str,
    description: str,
    status: str = "OPEN",
    priority: str = "MEDIUM",
    assignee_id: str | None = None,
) -> dict[str, Any]:
    """Create a new ticket document ready for insertion."""
    now = utc_now()
    return {
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


def serialize_ticket(
    document: dict[str, Any],
    *,
    customer: dict[str, Any] | None = None,
    assignee: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Map a MongoDB ticket document to a public payload."""
    payload = {
        "id": str(document["_id"]),
        "owner_id": document["owner_id"],
        "customer_id": document["customer_id"],
        "title": document["title"],
        "description": document["description"],
        "status": document["status"],
        "priority": document["priority"],
        "assignee_id": document.get("assignee_id"),
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
        "customer": customer,
        "assignee": assignee,
    }
    return payload
