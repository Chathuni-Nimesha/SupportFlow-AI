"""Conversation and message Pydantic schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


ConversationStatus = Literal["Open", "Waiting", "Closed", "AI Resolved"]
ConversationChannel = Literal["Chat", "Email", "Slack"]
MessageSenderType = Literal["customer", "ai", "agent"]


class ConversationCreateRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=200)
    customer_email: EmailStr
    subject: str = Field(min_length=1, max_length=500)
    channel: ConversationChannel = "Chat"
    status: ConversationStatus = "Open"
    assigned_agent_id: str | None = Field(default=None, max_length=100)
    unread_count: int = Field(default=0, ge=0)
    initial_message: str | None = Field(default=None, min_length=1, max_length=10000)


class ConversationUpdateRequest(BaseModel):
    subject: str | None = Field(default=None, min_length=1, max_length=500)
    status: ConversationStatus | None = None
    channel: ConversationChannel | None = None
    assigned_agent_id: str | None = Field(default=None, max_length=100)
    unread_count: int | None = Field(default=None, ge=0)
    customer_name: str | None = Field(default=None, min_length=1, max_length=200)
    customer_email: EmailStr | None = None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    customer_name: str
    customer_email: EmailStr
    subject: str
    status: ConversationStatus
    channel: ConversationChannel
    assigned_agent_id: str | None = None
    unread_count: int
    last_message: str
    created_at: datetime
    updated_at: datetime


class ConversationMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    sender_type: MessageSenderType = "agent"
    sender_name: str | None = Field(default=None, max_length=200)


class ConversationMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    sender_type: MessageSenderType
    sender_name: str | None = None
    content: str
    created_at: datetime
