"""User document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


USERS_COLLECTION = "users"


def utc_now() -> datetime:
    return datetime.now(UTC)


def build_user_document(
    *,
    first_name: str,
    last_name: str,
    company_name: str,
    email: str,
    password_hash: str,
) -> dict[str, Any]:
    """Create a new user document ready for insertion."""
    now = utc_now()
    return {
        "_id": str(uuid4()),
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "company_name": company_name.strip(),
        "email": email.strip().lower(),
        "password_hash": password_hash,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def serialize_user(document: dict[str, Any]) -> dict[str, Any]:
    """Map a MongoDB user document to a public user payload."""
    return {
        "id": str(document["_id"]),
        "first_name": document["first_name"],
        "last_name": document["last_name"],
        "company_name": document["company_name"],
        "email": document["email"],
        "is_active": bool(document.get("is_active", True)),
        "created_at": document["created_at"],
    }
