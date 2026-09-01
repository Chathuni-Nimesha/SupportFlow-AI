"""Team member directory API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.deps import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.team_member import (
    TeamMemberCreateRequest,
    TeamMemberResponse,
    TeamMemberRole,
    TeamMemberStatus,
    TeamMemberUpdateRequest,
)
from app.services import team_service

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=list[TeamMemberResponse])
async def list_team_members(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
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
) -> list[TeamMemberResponse]:
    return await team_service.list_team_members(
        current_user,
        query=q,
        role=role,
        member_status=member_status,
    )


@router.post(
    "",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team_member(
    payload: TeamMemberCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> TeamMemberResponse:
    return await team_service.create_team_member(current_user, payload)


@router.get("/{member_id}", response_model=TeamMemberResponse)
async def get_team_member(
    member_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> TeamMemberResponse:
    return await team_service.get_team_member(member_id, current_user)


@router.patch("/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    member_id: str,
    payload: TeamMemberUpdateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> TeamMemberResponse:
    return await team_service.update_team_member(
        member_id,
        current_user,
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
) -> Response:
    await team_service.delete_team_member(member_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
