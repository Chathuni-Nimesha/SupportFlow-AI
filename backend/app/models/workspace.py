"""Workspace document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


WORKSPACES_COLLECTION = "workspaces"


def personal_workspace_name(user: dict[str, Any]) -> str:
    """Prefer company_name; otherwise a readable personal workspace name."""
    company = str(user.get("company_name") or "").strip()
    if company:
        return company

    first = str(user.get("first_name") or "").strip()
    last = str(user.get("last_name") or "").strip()
    display = " ".join(part for part in (first, last) if part)
    if display:
        return f"{display}'s Workspace"

    email = str(user.get("email") or "").strip()
    if email:
        return f"{email}'s Workspace"
    return "Personal Workspace"


def utc_now() -> datetime:
    return datetime.now(UTC)


def normalize_optional_workspace_id(workspace_id: str | None) -> str | None:
    """Return a stripped workspace id, or None when missing or blank."""
    if workspace_id is None:
        return None
    cleaned = str(workspace_id).strip()
    return cleaned or None


def apply_optional_workspace_id(
    document: dict[str, Any],
    workspace_id: str | None,
) -> dict[str, Any]:
    """Attach workspace_id only when a non-empty value is provided."""
    cleaned = normalize_optional_workspace_id(workspace_id)
    if cleaned is not None:
        document["workspace_id"] = cleaned
    return document


def build_workspace_document(
    *,
    name: str,
    owner_user_id: str,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Create a new workspace document ready for insertion.

    Workspace ``_id`` is always a distinct UUID string and must not equal
    ``owner_user_id``. One personal workspace per user is the Phase 1 shape.
    """
    now = utc_now()
    owner = owner_user_id.strip()
    if not owner:
        raise ValueError("owner_user_id must not be empty")

    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("name must not be empty")

    document_id = (workspace_id or "").strip() or str(uuid4())
    if document_id == owner:
        raise ValueError("Workspace id must not equal owner_user_id.")

    return {
        "_id": document_id,
        "name": cleaned_name,
        "owner_user_id": owner,
        "created_at": now,
        "updated_at": now,
    }


def serialize_workspace(document: dict[str, Any]) -> dict[str, Any]:
    """Map a MongoDB workspace document to a public payload."""
    return {
        "id": str(document["_id"]),
        "name": document["name"],
        "owner_user_id": document["owner_user_id"],
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }
