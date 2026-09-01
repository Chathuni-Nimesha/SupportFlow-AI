"""Team member Pydantic schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


TeamMemberRole = Literal["OWNER", "ADMIN", "AGENT"]
TeamMemberStatus = Literal["ACTIVE", "INVITED", "DISABLED"]
AssignableTeamMemberRole = Literal["ADMIN", "AGENT"]


class TeamMemberCreateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    role: AssignableTeamMemberRole = "AGENT"
    status: TeamMemberStatus = "ACTIVE"

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned


class TeamMemberUpdateRequest(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    role: AssignableTeamMemberRole | None = None
    status: TeamMemberStatus | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_required(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    user_id: str | None = None
    first_name: str
    last_name: str
    email: EmailStr
    role: TeamMemberRole
    status: TeamMemberStatus
    created_at: datetime
    updated_at: datetime
