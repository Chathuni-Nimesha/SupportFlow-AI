"""Knowledge document Pydantic schemas."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


KnowledgeStatus = Literal["Draft", "Published"]
KnowledgeSourceType = Literal["manual", "url", "file"]
KnowledgeIngestionStatus = Literal[
    "pending",
    "indexed",
    "failed",
    "not_indexed",
]


class KnowledgeDocumentCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=100_000)
    source_type: KnowledgeSourceType = "manual"
    source: str | None = Field(default=None, max_length=1000)
    status: KnowledgeStatus = "Draft"
    tags: list[str] = Field(default_factory=list, max_length=50)


class KnowledgeDocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    content: str | None = Field(default=None, min_length=1, max_length=100_000)
    source_type: KnowledgeSourceType | None = None
    source: str | None = Field(default=None, max_length=1000)
    status: KnowledgeStatus | None = None
    tags: list[str] | None = Field(default=None, max_length=50)


class KnowledgeDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    workspace_id: str | None = None
    title: str
    content: str
    source_type: KnowledgeSourceType
    source: str | None = None
    status: KnowledgeStatus
    tags: list[str]
    ingestion_status: KnowledgeIngestionStatus = "not_indexed"
    ingestion_error: str | None = None
    ingested_at: datetime | None = None
    chunk_count: int = 0
    created_at: datetime
    updated_at: datetime


class KnowledgeIngestionResponse(BaseModel):
    document: KnowledgeDocumentResponse
    ingestion_status: KnowledgeIngestionStatus
    chunk_count: int = 0
    message: str


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)

    @field_validator("query")
    @classmethod
    def normalize_query(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("query must not be empty")
        return cleaned


class KnowledgeSearchHit(BaseModel):
    id: str
    document: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    distance: float | None = None
    score: float | None = None


class KnowledgeSearchResponse(BaseModel):
    query: str
    top_k: int
    count: int
    results: list[KnowledgeSearchHit]
