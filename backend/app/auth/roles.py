"""Workspace role authorization helpers.

Role always comes from the current user's ACTIVE ``team_members``
membership (``WorkspaceContext.role``). JWT, request bodies, and the
frontend are never the source of role.
"""

from collections.abc import Collection

from fastapi import HTTPException, status

OWNER_ADMIN_ROLES = frozenset({"OWNER", "ADMIN"})
ALL_WORKSPACE_ROLES = frozenset({"OWNER", "ADMIN", "AGENT"})

ROLE_FORBIDDEN = "You do not have permission to perform this action."
WORKSPACE_UPDATE_FORBIDDEN = "You do not have permission to update this workspace."
TEAM_MANAGE_FORBIDDEN = "You do not have permission to manage team members."
KNOWLEDGE_MANAGE_FORBIDDEN = (
    "You do not have permission to manage knowledge documents."
)


def require_any_workspace_role(
    role: str,
    allowed_roles: Collection[str],
    *,
    detail: str = ROLE_FORBIDDEN,
) -> None:
    """Raise 403 unless ``role`` is one of ``allowed_roles``."""
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


def require_workspace_role(
    role: str,
    *allowed_roles: str,
    detail: str = ROLE_FORBIDDEN,
) -> None:
    require_any_workspace_role(role, allowed_roles, detail=detail)


def require_owner_or_admin(
    role: str,
    *,
    detail: str = ROLE_FORBIDDEN,
) -> None:
    require_any_workspace_role(role, OWNER_ADMIN_ROLES, detail=detail)
