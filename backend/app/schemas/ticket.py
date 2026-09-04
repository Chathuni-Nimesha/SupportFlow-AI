"""Ticket Pydantic schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


from app.schemas.team_member import TeamMemberRole


TicketStatus = Literal["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"]
TicketPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]


class TicketCustomerSummary(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr


class TicketAssigneeSummary(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr
    role: TeamMemberRole


class TicketCreateRequest(BaseModel):
    customer_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=10000)
    status: TicketStatus = "OPEN"
    priority: TicketPriority = "MEDIUM"
    assignee_id: str | None = Field(default=None, max_length=100)

    @field_validator("customer_id", "title", "description")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @field_validator("assignee_id")
    @classmethod
    def strip_assignee(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class TicketUpdateRequest(BaseModel):
    customer_id: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=10000)
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assignee_id: str | None = Field(default=None, max_length=100)

    @field_validator("customer_id", "title", "description")
    @classmethod
    def strip_required(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @field_validator("assignee_id")
    @classmethod
    def strip_assignee(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    workspace_id: str | None = None
    customer_id: str
    title: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    assignee_id: str | None = None
    created_at: datetime
    updated_at: datetime
    customer: TicketCustomerSummary | None = None
    assignee: TicketAssigneeSummary | None = None
