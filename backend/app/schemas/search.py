"""Global workspace search schemas."""

from typing import Literal

from pydantic import BaseModel, Field


SearchResourceType = Literal[
    "conversation",
    "ticket",
    "customer",
    "knowledge",
]


class GlobalSearchHit(BaseModel):
    id: str
    type: SearchResourceType
    title: str
    subtitle: str | None = None
    href: str = Field(
        description="In-app path for navigation (includes deep-link query when applicable).",
    )


class GlobalSearchResponse(BaseModel):
    query: str
    conversations: list[GlobalSearchHit] = Field(default_factory=list)
    tickets: list[GlobalSearchHit] = Field(default_factory=list)
    customers: list[GlobalSearchHit] = Field(default_factory=list)
    knowledge: list[GlobalSearchHit] = Field(default_factory=list)
