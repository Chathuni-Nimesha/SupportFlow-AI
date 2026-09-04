"""Team member document helpers for MongoDB."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.models.workspace import apply_optional_workspace_id


TEAM_MEMBERS_COLLECTION = "team_members"

TEAM_MEMBER_ROLES = ("OWNER", "ADMIN", "AGENT")
TEAM_MEMBER_STATUSES = ("ACTIVE", "INVITED", "DISABLED")


def utc_now() -> datetime:
    return datetime.now(UTC)


def build_team_member_document(
    *,
    owner_id: str,
    first_name: str,
    last_name: str,
    email: str,
    role: str,
    status: str = "ACTIVE",
    user_id: str | None = None,
    member_id: str | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Create a new team member document ready for insertion."""
    now = utc_now()
    document = {
        "_id": member_id or str(uuid4()),
        "owner_id": owner_id,
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "email": email.strip().lower(),
        "role": role,
        "status": status,
        "created_at": now,
        "updated_at": now,
    }
    if user_id:
        document["user_id"] = user_id
    return apply_optional_workspace_id(document, workspace_id)


def serialize_team_member(document: dict[str, Any]) -> dict[str, Any]:
    """Map a MongoDB team member document to a public payload."""
    payload = {
        "id": str(document["_id"]),
        "owner_id": document["owner_id"],
        "user_id": document.get("user_id"),
        "first_name": document["first_name"],
        "last_name": document["last_name"],
        "email": document["email"],
        "role": document["role"],
        "status": document["status"],
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }
    workspace_id = document.get("workspace_id")
    if workspace_id:
        payload["workspace_id"] = str(workspace_id)
    return payload
