"""Workspace API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.deps import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.workspace import (
    WorkspaceDetailResponse,
    WorkspaceSummaryResponse,
    WorkspaceUpdateRequest,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceSummaryResponse])
async def list_workspaces(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> list[WorkspaceSummaryResponse]:
    return await workspace_service.list_workspaces_for_user(current_user)


@router.get("/{workspace_id}", response_model=WorkspaceDetailResponse)
async def get_workspace(
    workspace_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> WorkspaceDetailResponse:
    return await workspace_service.get_workspace_detail(workspace_id, current_user)


@router.patch("/{workspace_id}", response_model=WorkspaceDetailResponse)
async def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> WorkspaceDetailResponse:
    return await workspace_service.update_workspace_name(
        workspace_id,
        current_user,
        payload,
    )


@router.post("/{workspace_id}/select", response_model=WorkspaceDetailResponse)
async def select_workspace(
    workspace_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> WorkspaceDetailResponse:
    return await workspace_service.select_workspace(workspace_id, current_user)
