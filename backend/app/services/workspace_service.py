"""Workspace membership and context business logic."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.logging import get_logger
from app.database.mongodb import get_database
from app.models.team_member import (
    TEAM_MEMBERS_COLLECTION,
    build_team_member_document,
)
from app.models.user import USERS_COLLECTION
from app.models.workspace import (
    WORKSPACES_COLLECTION,
    build_workspace_document,
    personal_workspace_name,
    serialize_workspace,
    utc_now,
)
from app.auth.roles import (
    WORKSPACE_UPDATE_FORBIDDEN,
    require_owner_or_admin,
)
from app.schemas.auth import UserResponse
from app.schemas.workspace import (
    WorkspaceDetailResponse,
    WorkspaceSummaryResponse,
    WorkspaceUpdateRequest,
)

logger = get_logger(__name__)

NO_WORKSPACE_MEMBERSHIP = "No active workspace membership."
WORKSPACE_NOT_FOUND = "Workspace not found."


@dataclass
class WorkspaceContext:
    """Resolved tenant context for the authenticated user."""

    workspace: dict[str, Any]
    membership: dict[str, Any]

    @property
    def id(self) -> str:
        return str(self.workspace["_id"])

    @property
    def role(self) -> str:
        return str(self.membership.get("role") or "")


def _get_collection(name: str):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc
    return db[name]


def _workspaces():
    return _get_collection(WORKSPACES_COLLECTION)


def _members():
    return _get_collection(TEAM_MEMBERS_COLLECTION)


def _users():
    return _get_collection(USERS_COLLECTION)


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


def _has_workspace_id(document: dict[str, Any] | None) -> bool:
    if not document:
        return False
    value = document.get("workspace_id")
    return bool(str(value).strip()) if value is not None else False


def _active_membership_filter(user_id: str) -> dict[str, Any]:
    return {
        "user_id": user_id,
        "status": "ACTIVE",
    }


def _summary(workspace: dict[str, Any], role: str) -> dict[str, Any]:
    return {
        "id": str(workspace["_id"]),
        "name": workspace["name"],
        "role": role,
    }


async def persist_selected_workspace(user_id: str, workspace_id: str) -> None:
    """Store the user's selected current workspace. Not written to the JWT."""
    try:
        await _users().update_one(
            {"_id": user_id},
            {
                "$set": {
                    "default_workspace_id": workspace_id,
                    "updated_at": utc_now(),
                },
            },
        )
    except PyMongoError as exc:
        raise _db_error("persist selected workspace", exc) from exc


async def _load_stored_workspace_id(user: UserResponse) -> str | None:
    stored = (user.default_workspace_id or "").strip()
    if stored:
        return stored
    try:
        document = await _users().find_one({"_id": user.id})
    except PyMongoError as exc:
        raise _db_error("load selected workspace", exc) from exc
    if not document:
        return None
    value = document.get("default_workspace_id")
    cleaned = str(value).strip() if value is not None else ""
    return cleaned or None


def _detail(workspace: dict[str, Any], role: str) -> WorkspaceDetailResponse:
    payload = {**serialize_workspace(workspace), "role": role}
    return WorkspaceDetailResponse.model_validate(payload)


async def compensate_failed_registration(user_id: str) -> None:
    """Best-effort cleanup after a partial register."""
    try:
        await _members().delete_one(
            {"_id": user_id, "owner_id": user_id, "role": "OWNER"},
        )
        await _workspaces().delete_many({"owner_user_id": user_id})
        await _users().delete_one({"_id": user_id})
    except PyMongoError:
        logger.exception("Failed to compensate registration for user %s", user_id)


async def _find_owner_membership(
    user_id: str,
    workspace_id: str,
) -> dict[str, Any] | None:
    existing = await _members().find_one(
        {"_id": user_id, "owner_id": user_id, "role": "OWNER"},
    )
    if existing is not None:
        return existing
    existing = await _members().find_one(
        {
            "owner_id": user_id,
            "user_id": user_id,
            "role": "OWNER",
            "workspace_id": workspace_id,
        },
    )
    if existing is not None:
        return existing
    return await _members().find_one(
        {"owner_id": user_id, "user_id": user_id, "role": "OWNER"},
    )


async def ensure_owner_membership(
    user: dict[str, Any] | UserResponse,
    workspace: dict[str, Any],
) -> dict[str, Any]:
    """Ensure exactly one OWNER membership for the user's personal workspace.

    Preserves an existing OWNER ``_id``. Does not change assignee fields,
    ``owner_id``, populated ``user_id``, role, or status.
    """
    if isinstance(user, UserResponse):
        user_id = user.id
        first_name = user.first_name
        last_name = user.last_name
        email = str(user.email)
    else:
        user_id = str(user["_id"])
        first_name = str(user["first_name"])
        last_name = str(user["last_name"])
        email = str(user["email"])

    workspace_id = str(workspace["_id"])
    if workspace_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workspace id must not equal user id.",
        )

    try:
        existing = await _find_owner_membership(user_id, workspace_id)
        if existing is not None:
            updates: dict[str, Any] = {}
            if not _has_workspace_id(existing):
                updates["workspace_id"] = workspace_id
            if not existing.get("user_id"):
                updates["user_id"] = user_id
            if updates:
                await _members().update_one(
                    {"_id": existing["_id"]},
                    {"$set": updates},
                )
                existing.update(updates)
            return existing

        document = build_team_member_document(
            owner_id=user_id,
            user_id=user_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role="OWNER",
            status="ACTIVE",
            member_id=user_id,
            workspace_id=workspace_id,
        )
        await _members().insert_one(document)
        return document
    except DuplicateKeyError:
        found = await _find_owner_membership(user_id, workspace_id)
        if found is not None:
            if not _has_workspace_id(found):
                await _members().update_one(
                    {"_id": found["_id"]},
                    {"$set": {"workspace_id": workspace_id}},
                )
                found["workspace_id"] = workspace_id
            return found
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team member with this email already exists.",
        ) from None
    except PyMongoError as exc:
        raise _db_error("ensure owner workspace membership", exc) from exc


async def provision_personal_workspace(
    user: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Create or reuse the user's personal workspace and OWNER membership."""
    user_id = str(user["_id"])
    try:
        workspace = await _workspaces().find_one({"owner_user_id": user_id})
        if workspace is None:
            workspace = build_workspace_document(
                name=personal_workspace_name(user),
                owner_user_id=user_id,
            )
            try:
                await _workspaces().insert_one(workspace)
            except DuplicateKeyError:
                workspace = await _workspaces().find_one({"owner_user_id": user_id})
                if workspace is None:
                    raise
        membership = await ensure_owner_membership(user, workspace)
        await persist_selected_workspace(user_id, str(workspace["_id"]))
        return workspace, membership
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise _db_error("provision personal workspace", exc) from exc


async def repair_personal_workspace_owner(
    user: UserResponse,
) -> tuple[dict[str, Any], dict[str, Any]] | tuple[None, None]:
    """Repair OWNER membership when a personal workspace already exists."""
    try:
        workspace = await _workspaces().find_one({"owner_user_id": user.id})
    except PyMongoError as exc:
        raise _db_error("load personal workspace", exc) from exc
    if workspace is None:
        return None, None
    membership = await ensure_owner_membership(user, workspace)
    return workspace, membership


async def list_active_workspace_summaries(
    user: UserResponse,
) -> list[WorkspaceSummaryResponse]:
    await repair_personal_workspace_owner(user)
    try:
        cursor = _members().find(_active_membership_filter(user.id))
        memberships = await cursor.to_list(length=50)
    except PyMongoError as exc:
        raise _db_error("list workspace memberships", exc) from exc

    summaries: list[WorkspaceSummaryResponse] = []
    for membership in memberships:
        if not _has_workspace_id(membership):
            continue
        workspace_id = str(membership.get("workspace_id") or "").strip()
        if not workspace_id:
            continue
        try:
            workspace = await _workspaces().find_one({"_id": workspace_id})
        except PyMongoError as exc:
            raise _db_error("load workspace", exc) from exc
        if workspace is None:
            continue
        summaries.append(
            WorkspaceSummaryResponse.model_validate(
                _summary(workspace, str(membership.get("role") or "AGENT")),
            ),
        )
    return summaries


async def build_user_response(user: dict[str, Any] | UserResponse) -> UserResponse:
    if isinstance(user, UserResponse):
        response = user
    else:
        from app.models.user import serialize_user

        response = UserResponse.model_validate(serialize_user(user))

    await repair_personal_workspace_owner(response)
    summaries = await list_active_workspace_summaries(response)
    stored_id = await _load_stored_workspace_id(response)
    summary_ids = {item.id for item in summaries}

    default_id = stored_id if stored_id and stored_id in summary_ids else None
    if default_id is None:
        try:
            personal = await _workspaces().find_one({"owner_user_id": response.id})
        except PyMongoError as exc:
            raise _db_error("load personal workspace", exc) from exc
        if personal is not None and str(personal["_id"]) in summary_ids:
            default_id = str(personal["_id"])
        elif summaries:
            default_id = summaries[0].id
        if default_id and default_id != stored_id:
            await persist_selected_workspace(response.id, default_id)

    return response.model_copy(
        update={
            "default_workspace_id": default_id,
            "workspaces": summaries,
        },
    )


async def resolve_current_workspace(user: UserResponse) -> WorkspaceContext:
    """JWT user → selected workspace (if valid) → ACTIVE membership → workspace.

    Selected workspace is ``users.default_workspace_id``. It is not read from
    the JWT or from client request bodies.
    """
    await repair_personal_workspace_owner(user)
    try:
        cursor = _members().find(_active_membership_filter(user.id))
        memberships = await cursor.to_list(length=50)
    except PyMongoError as exc:
        raise _db_error("resolve workspace membership", exc) from exc

    valid: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for row in memberships:
        if not _has_workspace_id(row):
            continue
        workspace_id = str(row["workspace_id"]).strip()
        if not workspace_id or workspace_id == user.id:
            continue
        try:
            workspace = await _workspaces().find_one({"_id": workspace_id})
        except PyMongoError as exc:
            raise _db_error("load workspace", exc) from exc
        if workspace is None:
            continue
        valid.append((workspace, row))

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=NO_WORKSPACE_MEMBERSHIP,
        )

    stored_id = await _load_stored_workspace_id(user)
    match = next(
        (
            item
            for item in valid
            if stored_id and str(item[0]["_id"]) == stored_id
        ),
        None,
    )
    if match is None:
        try:
            personal = await _workspaces().find_one({"owner_user_id": user.id})
        except PyMongoError as exc:
            raise _db_error("load personal workspace", exc) from exc
        if personal is not None:
            personal_id = str(personal["_id"])
            match = next(
                (item for item in valid if str(item[0]["_id"]) == personal_id),
                None,
            )
        if match is None:
            match = valid[0]
        healed_id = str(match[0]["_id"])
        if healed_id != stored_id:
            await persist_selected_workspace(user.id, healed_id)

    return WorkspaceContext(workspace=match[0], membership=match[1])


async def get_workspace_for_member(
    workspace_id: str,
    user: UserResponse,
) -> WorkspaceContext:
    await repair_personal_workspace_owner(user)
    cleaned = (workspace_id or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=WORKSPACE_NOT_FOUND,
        )
    try:
        membership = await _members().find_one(
            {
                "user_id": user.id,
                "status": "ACTIVE",
                "workspace_id": cleaned,
            },
        )
        workspace = await _workspaces().find_one({"_id": cleaned})
    except PyMongoError as exc:
        raise _db_error("load workspace membership", exc) from exc

    if membership is None or workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=WORKSPACE_NOT_FOUND,
        )
    return WorkspaceContext(workspace=workspace, membership=membership)


async def list_workspaces_for_user(
    user: UserResponse,
) -> list[WorkspaceSummaryResponse]:
    return await list_active_workspace_summaries(user)


async def get_workspace_detail(
    workspace_id: str,
    user: UserResponse,
) -> WorkspaceDetailResponse:
    context = await get_workspace_for_member(workspace_id, user)
    return _detail(context.workspace, context.role)


async def update_workspace_name(
    workspace_id: str,
    user: UserResponse,
    payload: WorkspaceUpdateRequest,
) -> WorkspaceDetailResponse:
    context = await get_workspace_for_member(workspace_id, user)
    require_owner_or_admin(context.role, detail=WORKSPACE_UPDATE_FORBIDDEN)

    try:
        await _workspaces().update_one(
            {"_id": context.id},
            {"$set": {"name": payload.name, "updated_at": utc_now()}},
        )
        workspace = await _workspaces().find_one({"_id": context.id})
    except PyMongoError as exc:
        raise _db_error("update workspace", exc) from exc

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=WORKSPACE_NOT_FOUND,
        )
    return _detail(workspace, context.role)


async def select_workspace(
    workspace_id: str,
    user: UserResponse,
) -> WorkspaceDetailResponse:
    """Set the authenticated user's current workspace after membership checks."""
    context = await get_workspace_for_member(workspace_id, user)
    await persist_selected_workspace(user.id, context.id)
    return _detail(context.workspace, context.role)
