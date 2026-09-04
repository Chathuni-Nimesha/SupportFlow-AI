"""Team member directory business logic.

``team_members`` is the workspace membership model. Tenant boundary is
``workspace_id = current_workspace.id``. Role authorization is not applied
here; OWNER role/status/delete protections keep their existing behavior.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.logging import get_logger
from app.core.pagination import paginate_find, paginated_payload
from app.database.mongodb import get_database
from app.models.team_member import (
    TEAM_MEMBERS_COLLECTION,
    build_team_member_document,
    serialize_team_member,
    utc_now,
)
from app.models.ticket import TICKETS_COLLECTION
from app.models.user import USERS_COLLECTION
from app.schemas.auth import UserResponse
from app.schemas.team_member import (
    TeamMemberCreateRequest,
    TeamMemberResponse,
    TeamMemberUpdateRequest,
)
from app.services.workspace_service import ensure_owner_membership

logger = get_logger(__name__)

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


def _members():
    return _get_collection(TEAM_MEMBERS_COLLECTION)


def _users():
    return _get_collection(USERS_COLLECTION)


def _tickets():
    return _get_collection(TICKETS_COLLECTION)


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


def _require_id(value: str, label: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}.",
        )
    return cleaned


def _member_filter(member_id: str, workspace_id: str) -> dict[str, str]:
    return {"_id": member_id, "workspace_id": workspace_id}


def _escape_search(term: str) -> str:
    return _REGEX_SPECIAL.sub(lambda match: "\\" + match.group(0), term)


def _name_email_search(cleaned: str) -> dict[str, Any]:
    tokens = [token for token in cleaned.split() if token]
    clauses = []
    for token in tokens:
        pattern = _escape_search(token)
        clauses.append(
            {
                "$or": [
                    {"first_name": {"$regex": pattern, "$options": "i"}},
                    {"last_name": {"$regex": pattern, "$options": "i"}},
                    {"email": {"$regex": pattern, "$options": "i"}},
                ]
            }
        )
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _to_response(document: dict[str, Any]) -> TeamMemberResponse:
    return TeamMemberResponse.model_validate(serialize_team_member(document))


async def ensure_owner_member(
    current_user: UserResponse,
    workspace_id: str,
) -> dict[str, Any]:
    """Guarantee the authenticated account exists as the workspace OWNER."""
    workspace_id = _require_id(workspace_id, "workspace id")
    return await ensure_owner_membership(current_user, {"_id": workspace_id})


async def ensure_owner_member_by_id(
    owner_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    """Repair OWNER membership when assigning tickets/conversations to the owner."""
    owner_id = _require_id(owner_id, "team member id")
    workspace_id = _require_id(workspace_id, "workspace id")
    try:
        user = await _users().find_one({"_id": owner_id})
    except PyMongoError as exc:
        raise _db_error("ensure owner team member", exc) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )
    return await ensure_owner_membership(user, {"_id": workspace_id})


async def _get_workspace_member(member_id: str, workspace_id: str) -> dict[str, Any]:
    member_id = _require_id(member_id, "team member id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _members().find_one(
            _member_filter(member_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("fetch team member", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )
    return document


def _membership_in_workspace(document: dict[str, Any] | None, workspace_id: str) -> bool:
    if document is None:
        return False
    return str(document.get("workspace_id") or "") == workspace_id


async def require_assignable_member(
    member_id: str | None,
    workspace_id: str,
    *,
    owner_id: str | None = None,
) -> str | None:
    """Return a team member id that may receive a ticket or conversation assignment."""
    if member_id is None:
        return None
    cleaned = member_id.strip()
    if not cleaned:
        return None

    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _members().find_one(
            _member_filter(cleaned, workspace_id),
        )
    except PyMongoError as extra:
        raise _db_error("fetch team member", extra) from extra

    if document is None and owner_id and cleaned == owner_id:
        repaired = await ensure_owner_member_by_id(owner_id, workspace_id)
        document = repaired if _membership_in_workspace(repaired, workspace_id) else None

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    if document.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignee is not an active team member.",
        )
    return str(document["_id"])


async def member_summaries(
    workspace_id: str,
    member_ids: list[str],
    *,
    owner_id: str | None = None,
) -> dict[str, dict[str, Any]]:
    unique_ids = [mid for mid in dict.fromkeys(member_ids) if mid]
    if not unique_ids:
        return {}

    workspace_id = _require_id(workspace_id, "workspace id")
    if owner_id and owner_id in unique_ids:
        repaired = await ensure_owner_member_by_id(owner_id, workspace_id)
        if not _membership_in_workspace(repaired, workspace_id):
            unique_ids = [mid for mid in unique_ids if mid != owner_id]

    try:
        cursor = _members().find(
            {"_id": {"$in": unique_ids}, "workspace_id": workspace_id},
        )
        documents = await cursor.to_list(length=len(unique_ids))
    except PyMongoError as extra:
        raise _db_error("fetch ticket assignees", extra) from extra

    return {
        str(doc["_id"]): {
            "id": str(doc["_id"]),
            "first_name": doc["first_name"],
            "last_name": doc["last_name"],
            "email": doc["email"],
            "role": doc["role"],
        }
        for doc in documents
    }


async def list_team_members(
    current_user: UserResponse,
    workspace_id: str,
    *,
    query: str | None = None,
    role: str | None = None,
    member_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    workspace_id = _require_id(workspace_id, "workspace id")
    await ensure_owner_member(current_user, workspace_id)
    filters: dict[str, Any] = {"workspace_id": workspace_id}
    if role:
        filters["role"] = role
    if member_status:
        filters["status"] = member_status
    cleaned = (query or "").strip()
    if cleaned:
        filters.update(_name_email_search(cleaned))

    try:
        documents, total = await paginate_find(
            _members(),
            filters,
            page=page,
            page_size=page_size,
        )
    except PyMongoError as extra:
        raise _db_error("list team members", extra) from extra

    return paginated_payload(
        [_to_response(doc) for doc in documents],
        page=page,
        page_size=page_size,
        total=total,
    )


async def get_team_member(
    member_id: str,
    current_user: UserResponse,
    workspace_id: str,
) -> TeamMemberResponse:
    await ensure_owner_member(current_user, workspace_id)
    document = await _get_workspace_member(member_id, workspace_id)
    return _to_response(document)


async def create_team_member(
    current_user: UserResponse,
    workspace_id: str,
    payload: TeamMemberCreateRequest,
) -> TeamMemberResponse:
    workspace_id = _require_id(workspace_id, "workspace id")
    await ensure_owner_member(current_user, workspace_id)
    document = build_team_member_document(
        owner_id=current_user.id,
        workspace_id=workspace_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email),
        role=payload.role,
        status=payload.status,
        user_id=None,
    )

    try:
        await _members().insert_one(document)
    except DuplicateKeyError as extra:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists.",
        ) from extra
    except PyMongoError as extra:
        raise _db_error("create team member", extra) from extra

    return _to_response(document)


async def update_team_member(
    member_id: str,
    current_user: UserResponse,
    workspace_id: str,
    payload: TeamMemberUpdateRequest,
) -> TeamMemberResponse:
    await ensure_owner_member(current_user, workspace_id)
    document = await _get_workspace_member(member_id, workspace_id)
    member_id = str(document["_id"])
    workspace_id = _require_id(workspace_id, "workspace id")

    if document.get("role") == "OWNER":
        if payload.role is not None or payload.status is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The workspace owner role and status cannot be changed.",
            )

    updates = payload.model_dump(exclude_unset=True)
    updates.pop("workspace_id", None)
    updates.pop("owner_id", None)
    updates.pop("user_id", None)
    if "email" in updates and updates["email"] is not None:
        updates["email"] = str(updates["email"]).strip().lower()

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    updates["updated_at"] = utc_now()
    tenant_filter = _member_filter(member_id, workspace_id)

    try:
        await _members().update_one(
            tenant_filter,
            {"$set": updates},
        )
        updated = await _members().find_one(tenant_filter)
    except DuplicateKeyError as extra:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists.",
        ) from extra
    except PyMongoError as extra:
        raise _db_error("update team member", extra) from extra

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )
    return _to_response(updated)


async def delete_team_member(
    member_id: str,
    current_user: UserResponse,
    workspace_id: str,
) -> None:
    await ensure_owner_member(current_user, workspace_id)
    document = await _get_workspace_member(member_id, workspace_id)
    member_id = str(document["_id"])
    workspace_id = _require_id(workspace_id, "workspace id")

    if document.get("role") == "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The workspace owner cannot be removed.",
        )

    try:
        await _tickets().update_many(
            {"workspace_id": workspace_id, "assignee_id": member_id},
            {"$set": {"assignee_id": None, "updated_at": utc_now()}},
        )
        result = await _members().delete_one(
            _member_filter(member_id, workspace_id),
        )
    except PyMongoError as extra:
        raise _db_error("delete team member", extra) from extra

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )
