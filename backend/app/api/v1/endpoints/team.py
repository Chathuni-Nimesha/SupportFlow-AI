"""Team member directory API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DEFAULT_LIST_PAGE, DEFAULT_LIST_PAGE_SIZE, PageParam, PageSizeParam
from app.auth.deps import get_current_user, get_current_workspace, require_team_manager
from app.schemas.auth import UserResponse
from app.schemas.pagination import PaginatedResponse
from app.schemas.team_member import (
    TeamMemberCreateRequest,
    TeamMemberResponse,
    TeamMemberRole,
    TeamMemberStatus,
    TeamMemberUpdateRequest,
)
from app.services import team_service
from app.services.workspace_service import WorkspaceContext

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=PaginatedResponse[TeamMemberResponse])
async def list_team_members(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search name or email"),
    ] = None,
    role: Annotated[
        TeamMemberRole | None,
        Query(description="Filter by role"),
    ] = None,
    member_status: Annotated[
        TeamMemberStatus | None,
        Query(alias="status", description="Filter by status"),
    ] = None,
    page: PageParam = DEFAULT_LIST_PAGE,
    page_size: PageSizeParam = DEFAULT_LIST_PAGE_SIZE,
) -> PaginatedResponse[TeamMemberResponse]:
    return await team_service.list_team_members(
        current_user,
        current_workspace.id,
        query=q,
        role=role,
        member_status=member_status,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team_member(
    payload: TeamMemberCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(require_team_manager)],
) -> TeamMemberResponse:
    return await team_service.create_team_member(
        current_user,
        current_workspace.id,
        payload,
    )


@router.get("/{member_id}", response_model=TeamMemberResponse)
async def get_team_member(
    member_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> TeamMemberResponse:
    return await team_service.get_team_member(
        member_id,
        current_user,
        current_workspace.id,
    )


@router.patch("/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    member_id: str,
    payload: TeamMemberUpdateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(require_team_manager)],
) -> TeamMemberResponse:
    return await team_service.update_team_member(
        member_id,
        current_user,
        current_workspace.id,
        payload,
    )


@router.delete(
    "/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_team_member(
    member_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(require_team_manager)],
) -> Response:
    await team_service.delete_team_member(
        member_id,
        current_user,
        current_workspace.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
