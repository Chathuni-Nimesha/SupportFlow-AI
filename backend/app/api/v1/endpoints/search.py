"""Workspace-scoped global search API."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth.deps import get_current_user, get_current_workspace
from app.schemas.auth import UserResponse
from app.schemas.search import GlobalSearchResponse
from app.services import global_search_service
from app.services.workspace_service import WorkspaceContext

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=GlobalSearchResponse)
async def search_workspace(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    q: Annotated[
        str,
        Query(
            max_length=global_search_service.MAX_QUERY_LENGTH,
            description="Search query across conversations, tickets, customers, and knowledge",
        ),
    ],
    limit: Annotated[
        int | None,
        Query(
            ge=1,
            le=global_search_service.MAX_PER_TYPE_LIMIT,
            description="Max results per resource type",
        ),
    ] = None,
) -> GlobalSearchResponse:
    """Search the current workspace. Tenant comes from auth, not the client."""
    _ = current_user  # auth enforced via dependency
    return await global_search_service.global_search(
        workspace_id=current_workspace.id,
        query=q,
        per_type_limit=limit,
    )
