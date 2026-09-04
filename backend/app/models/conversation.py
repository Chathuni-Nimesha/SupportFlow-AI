"""Conversation document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.models.workspace import apply_optional_workspace_id


CONVERSATIONS_COLLECTION = "conversations"

CONVERSATION_STATUSES = ("Open", "Waiting", "Closed", "AI Resolved")
CONVERSATION_CHANNELS = ("Chat", "Email", "Slack")


def utc_now() -> datetime:
    return datetime.now(UTC)


def normalize_optional_customer_id(customer_id: str | None) -> str | None:
    """Return a stripped customer id, or None when missing or blank."""
    if customer_id is None:
        return None
    cleaned = str(customer_id).strip()
    return cleaned or None


def apply_optional_customer_id(
    document: dict[str, Any],
    customer_id: str | None,
) -> dict[str, Any]:
    """Attach customer_id only when a non-empty value is provided."""
    cleaned = normalize_optional_customer_id(customer_id)
    if cleaned is not None:
        document["customer_id"] = cleaned
    return document


def build_conversation_document(
    *,
    owner_id: str,
    customer_name: str,
    customer_email: str,
    subject: str,
    channel: str,
    status: str = "Open",
    assigned_agent_id: str | None = None,
    unread_count: int = 0,
    workspace_id: str | None = None,
    customer_id: str | None = None,
) -> dict[str, Any]:
    """Create a new conversation document ready for insertion."""
    now = utc_now()
    document = {
        "_id": str(uuid4()),
        "owner_id": owner_id,
        "customer_name": customer_name.strip(),
        "customer_email": customer_email.strip().lower(),
        "subject": subject.strip(),
        "status": status,
        "channel": channel,
        "assigned_agent_id": assigned_agent_id,
        "unread_count": max(0, unread_count),
        "last_message": "",
        "created_at": now,
        "updated_at": now,
    }
    apply_optional_workspace_id(document, workspace_id)
    return apply_optional_customer_id(document, customer_id)


def serialize_conversation(document: dict[str, Any]) -> dict[str, Any]:
    """Map a MongoDB conversation document to a public payload."""
    payload = {
        "id": str(document["_id"]),
        "owner_id": document["owner_id"],
        "customer_id": normalize_optional_customer_id(document.get("customer_id")),
        "customer_name": document["customer_name"],
        "customer_email": document["customer_email"],
        "subject": document["subject"],
        "status": document["status"],
        "channel": document["channel"],
        "assigned_agent_id": document.get("assigned_agent_id"),
        "unread_count": int(document.get("unread_count", 0)),
        "last_message": document.get("last_message") or "",
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }
    workspace_id = document.get("workspace_id")
    if workspace_id:
        payload["workspace_id"] = str(workspace_id)
    return payload
