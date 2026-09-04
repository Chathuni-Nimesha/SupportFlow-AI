"""FastAPI authentication and workspace-role dependencies."""

from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.roles import (
    KNOWLEDGE_MANAGE_FORBIDDEN,
    ROLE_FORBIDDEN,
    TEAM_MANAGE_FORBIDDEN,
    require_any_workspace_role as assert_any_workspace_role,
)
from app.core.security import TokenError, get_subject_from_token
from app.models.user import serialize_user
from app.schemas.auth import UserResponse
from app.services.auth_service import get_user_by_id
from app.services.workspace_service import (
    WorkspaceContext,
    resolve_current_workspace,
)

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> UserResponse:
    """Resolve and return the authenticated user from a Bearer JWT."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = get_subject_from_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=exc.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    document = await get_user_by_id(user_id)
    return UserResponse.model_validate(serialize_user(document))


async def get_current_workspace(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> WorkspaceContext:
    """Resolve the authenticated user's selected workspace from membership.

    JWT ``sub`` is the user id. Tenant id is ``Workspace._id``, never the
    user id. The selected workspace is ``users.default_workspace_id`` and is
    not read from the token.
    """
    return await resolve_current_workspace(current_user)


def require_any_workspace_role(
    *allowed_roles: str,
    detail: str = ROLE_FORBIDDEN,
) -> Callable[..., Coroutine[Any, Any, WorkspaceContext]]:
    """Dependency: current ACTIVE membership role must be one of ``allowed_roles``."""

    allowed = frozenset(allowed_roles)

    async def _checker(
        current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    ) -> WorkspaceContext:
        assert_any_workspace_role(
            current_workspace.role,
            allowed,
            detail=detail,
        )
        return current_workspace

    return _checker


def require_workspace_role(
    *allowed_roles: str,
    detail: str = ROLE_FORBIDDEN,
) -> Callable[..., Coroutine[Any, Any, WorkspaceContext]]:
    return require_any_workspace_role(*allowed_roles, detail=detail)


require_owner_or_admin = require_any_workspace_role("OWNER", "ADMIN")
require_team_manager = require_any_workspace_role(
    "OWNER",
    "ADMIN",
    detail=TEAM_MANAGE_FORBIDDEN,
)
require_knowledge_manager = require_any_workspace_role(
    "OWNER",
    "ADMIN",
    detail=KNOWLEDGE_MANAGE_FORBIDDEN,
)
