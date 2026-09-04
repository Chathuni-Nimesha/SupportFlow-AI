"""Workspace Pydantic schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.team_member import TeamMemberRole


WorkspaceMemberRole = TeamMemberRole
EditableWorkspaceRole = Literal["OWNER", "ADMIN"]


class WorkspaceCreate(BaseModel):
    """Internal creation payload."""

    name: str = Field(min_length=1, max_length=200)
    owner_user_id: str = Field(min_length=1, max_length=100)

    @field_validator("name", "owner_user_id")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned


class WorkspaceUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned


class WorkspaceSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: WorkspaceMemberRole


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    owner_user_id: str
    created_at: datetime
    updated_at: datetime


class WorkspaceDetailResponse(WorkspaceResponse):
    role: WorkspaceMemberRole
