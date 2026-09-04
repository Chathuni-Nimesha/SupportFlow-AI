"""Customer document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.models.workspace import apply_optional_workspace_id


CUSTOMERS_COLLECTION = "customers"


def utc_now() -> datetime:
    return datetime.now(UTC)


def build_customer_document(
    *,
    owner_id: str,
    first_name: str,
    last_name: str,
    email: str,
    phone: str | None = None,
    company: str | None = None,
    notes: str | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Create a new customer document ready for insertion."""
    now = utc_now()
    document = {
        "_id": str(uuid4()),
        "owner_id": owner_id,
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "email": email.strip().lower(),
        "phone": phone.strip() if phone else None,
        "company": company.strip() if company else None,
        "notes": notes.strip() if notes else None,
        "created_at": now,
        "updated_at": now,
    }
    return apply_optional_workspace_id(document, workspace_id)


def serialize_customer(document: dict[str, Any]) -> dict[str, Any]:
    """Map a MongoDB customer document to a public payload."""
    payload = {
        "id": str(document["_id"]),
        "owner_id": document["owner_id"],
        "first_name": document["first_name"],
        "last_name": document["last_name"],
        "email": document["email"],
        "phone": document.get("phone"),
        "company": document.get("company"),
        "notes": document.get("notes"),
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }
    workspace_id = document.get("workspace_id")
    if workspace_id:
        payload["workspace_id"] = str(workspace_id)
    return payload
