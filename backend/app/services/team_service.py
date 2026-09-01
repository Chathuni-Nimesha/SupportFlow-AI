"""Team member directory business logic."""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.logging import get_logger
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


async def ensure_owner_member(current_user: UserResponse) -> dict[str, Any]:
    """Guarantee the authenticated account exists as the workspace OWNER."""
    owner_id = current_user.id
    try:
        existing = await _members().find_one(
            {"_id": owner_id, "owner_id": owner_id},
        )
        if existing is not None:
            return existing

        document = build_team_member_document(
            owner_id=owner_id,
            user_id=owner_id,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            email=str(current_user.email),
            role="OWNER",
            status="ACTIVE",
            member_id=owner_id,
        )
        await _members().insert_one(document)
        return document
    except DuplicateKeyError:
        document = await _members().find_one(
            {"_id": owner_id, "owner_id": owner_id},
        )
        if document is not None:
            return document
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists.",
        )
    except PyMongoError as exc:
        raise _db_error("ensure owner team member", exc) from exc


async def ensure_owner_member_by_id(owner_id: str) -> dict[str, Any]:
    try:
        existing = await _members().find_one(
            {"_id": owner_id, "owner_id": owner_id},
        )
        if existing is not None:
            return existing
        user = await _users().find_one({"_id": owner_id})
    except PyMongoError as exc:
        raise _db_error("ensure owner team member", exc) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    document = build_team_member_document(
        owner_id=owner_id,
        user_id=owner_id,
        first_name=user["first_name"],
        last_name=user["last_name"],
        email=user["email"],
        role="OWNER",
        status="ACTIVE",
        member_id=owner_id,
    )
    try:
        await _members().insert_one(document)
        return document
    except DuplicateKeyError:
        found = await _members().find_one({"_id": owner_id, "owner_id": owner_id})
        if found is not None:
            return found
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists.",
        )
    except PyMongoError as exc:
        raise _db_error("ensure owner team member", exc) from exc


async def _get_owned_member(member_id: str, owner_id: str) -> dict[str, Any]:
    if not member_id or not member_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team member id.",
        )

    try:
        document = await _members().find_one(
            {"_id": member_id, "owner_id": owner_id},
        )
    except PyMongoError as exc:
        raise _db_error("fetch team member", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )
    return document


async def require_assignable_member(
    member_id: str | None,
    owner_id: str,
) -> str | None:
    """Return a team member id that may own a ticket assignment."""
    if member_id is None:
        return None
    cleaned = member_id.strip()
    if not cleaned:
        return None

    if cleaned == owner_id:
        document = await ensure_owner_member_by_id(owner_id)
    else:
        document = await _get_owned_member(cleaned, owner_id)

    if document.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignee is not an active team member.",
        )
    return str(document["_id"])


async def member_summaries(
    owner_id: str,
    member_ids: list[str],
) -> dict[str, dict[str, Any]]:
    unique_ids = [mid for mid in dict.fromkeys(member_ids) if mid]
    if not unique_ids:
        return {}

    if owner_id in unique_ids:
        await ensure_owner_member_by_id(owner_id)

    try:
        cursor = _members().find(
            {"_id": {"$in": unique_ids}, "owner_id": owner_id},
        )
        documents = await cursor.to_list(length=len(unique_ids))
    except PyMongoError as exc:
        raise _db_error("fetch ticket assignees", exc) from exc

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
    *,
    query: str | None = None,
    role: str | None = None,
    member_status: str | None = None,
) -> list[TeamMemberResponse]:
    await ensure_owner_member(current_user)
    owner_id = current_user.id
    filters: dict[str, Any] = {"owner_id": owner_id}
    if role:
        filters["role"] = role
    if member_status:
        filters["status"] = member_status
    cleaned = (query or "").strip()
    if cleaned:
        filters.update(_name_email_search(cleaned))

    try:
        cursor = _members().find(filters).sort("updated_at", -1)
        documents = await cursor.to_list(length=500)
    except PyMongoError as exc:
        raise _db_error("list team members", exc) from exc

    return [_to_response(doc) for doc in documents]


async def get_team_member(
    member_id: str,
    current_user: UserResponse,
) -> TeamMemberResponse:
    await ensure_owner_member(current_user)
    document = await _get_owned_member(member_id, current_user.id)
    return _to_response(document)


async def create_team_member(
    current_user: UserResponse,
    payload: TeamMemberCreateRequest,
) -> TeamMemberResponse:
    await ensure_owner_member(current_user)
    document = build_team_member_document(
        owner_id=current_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email),
        role=payload.role,
        status=payload.status,
        user_id=None,
    )

    try:
        await _members().insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists.",
        ) from exc
    except PyMongoError as exc:
        raise _db_error("create team member", exc) from exc

    return _to_response(document)


async def update_team_member(
    member_id: str,
    current_user: UserResponse,
    payload: TeamMemberUpdateRequest,
) -> TeamMemberResponse:
    await ensure_owner_member(current_user)
    document = await _get_owned_member(member_id, current_user.id)

    if document.get("role") == "OWNER":
        if payload.role is not None or payload.status is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The workspace owner role and status cannot be changed.",
            )

    updates = payload.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"] is not None:
        updates["email"] = str(updates["email"]).strip().lower()

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    updates["updated_at"] = utc_now()

    try:
        await _members().update_one(
            {"_id": member_id, "owner_id": current_user.id},
            {"$set": updates},
        )
        updated = await _members().find_one(
            {"_id": member_id, "owner_id": current_user.id},
        )
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists.",
        ) from exc
    except PyMongoError as exc:
        raise _db_error("update team member", exc) from exc

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )
    return _to_response(updated)


async def delete_team_member(member_id: str, current_user: UserResponse) -> None:
    await ensure_owner_member(current_user)
    document = await _get_owned_member(member_id, current_user.id)

    if document.get("role") == "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The workspace owner cannot be removed.",
        )

    try:
        await _tickets().update_many(
            {"owner_id": current_user.id, "assignee_id": member_id},
            {"$set": {"assignee_id": None, "updated_at": utc_now()}},
        )
        result = await _members().delete_one(
            {"_id": member_id, "owner_id": current_user.id},
        )
    except PyMongoError as exc:
        raise _db_error("delete team member", exc) from exc

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )
