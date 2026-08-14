"""Message document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


MESSAGES_COLLECTION = "messages"

MESSAGE_SENDER_TYPES = ("customer", "ai", "agent")


def utc_now() -> datetime:
    return datetime.now(UTC)


def build_message_document(
    *,
    conversation_id: str,
    owner_id: str,
    sender_type: str,
    content: str,
    sender_name: str | None = None,
) -> dict[str, Any]:
    """Create a new message document ready for insertion."""
    return {
        "_id": str(uuid4()),
        "conversation_id": conversation_id,
        "owner_id": owner_id,
        "sender_type": sender_type,
        "sender_name": sender_name.strip() if sender_name else None,
        "content": content.strip(),
        "created_at": utc_now(),
    }


def serialize_message(document: dict[str, Any]) -> dict[str, Any]:
    """Map a MongoDB message document to a public payload."""
    return {
        "id": str(document["_id"]),
        "conversation_id": document["conversation_id"],
        "sender_type": document["sender_type"],
        "sender_name": document.get("sender_name"),
        "content": document["content"],
        "created_at": document["created_at"],
    }
