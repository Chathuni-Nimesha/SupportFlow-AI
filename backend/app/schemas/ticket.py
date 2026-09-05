"""Ticket Pydantic schemas."""

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, field_validator

from app.models.ticket import TICKET_PRIORITIES, TICKET_STATUSES
from app.schemas.team_member import TeamMemberRole


TicketStatus = Literal["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"]
TicketPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]

_STATUS_CHOICES = ", ".join(TICKET_STATUSES)
_PRIORITY_CHOICES = ", ".join(TICKET_PRIORITIES)


def _coerce_ticket_status(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned in TICKET_STATUSES:
            return cleaned
    raise ValueError(f"Invalid status. Must be one of: {_STATUS_CHOICES}.")


def _coerce_ticket_priority(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned in TICKET_PRIORITIES:
            return cleaned
    raise ValueError(f"Invalid priority. Must be one of: {_PRIORITY_CHOICES}.")


ValidatedTicketStatus = Annotated[
    TicketStatus,
    BeforeValidator(_coerce_ticket_status),
]
ValidatedTicketPriority = Annotated[
    TicketPriority,
    BeforeValidator(_coerce_ticket_priority),
]


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
    status: ValidatedTicketStatus = "OPEN"
    priority: ValidatedTicketPriority = "MEDIUM"
    assignee_id: str | None = Field(default=None, max_length=100)
    conversation_id: str | None = Field(default=None, max_length=100)

    @field_validator("customer_id", "title", "description")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @field_validator("assignee_id", "conversation_id")
    @classmethod
    def strip_optional_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class TicketUpdateRequest(BaseModel):
    customer_id: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=10000)
    status: ValidatedTicketStatus | None = None
    priority: ValidatedTicketPriority | None = None
    assignee_id: str | None = Field(default=None, max_length=100)
    conversation_id: str | None = Field(default=None, max_length=100)

    @field_validator("customer_id", "title", "description")
    @classmethod
    def strip_required(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @field_validator("assignee_id", "conversation_id")
    @classmethod
    def strip_optional_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    workspace_id: str | None = None
    customer_id: str | None = None
    conversation_id: str | None = None
    title: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    assignee_id: str | None = None
    created_at: datetime
    updated_at: datetime
    customer: TicketCustomerSummary | None = None
    assignee: TicketAssigneeSummary | None = None
