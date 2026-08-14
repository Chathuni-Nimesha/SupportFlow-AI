"""AI / RAG API schemas."""

from typing import Any

from pydantic import BaseModel, Field, field_validator


class AiAnswerRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("question must not be empty")
        return cleaned


class AiAnswerSource(BaseModel):
    document_id: str | None = None
    title: str | None = None
    source: str | None = None
    chunk_id: str | None = None
    score: float | None = None
    distance: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AiAnswerResponse(BaseModel):
    answer: str
    sources: list[AiAnswerSource]
    retrieved_count: int
    used_generation: bool = False


class ConversationAiSuggestRequest(BaseModel):
    """Optional knobs for conversation AI suggestions (question comes from messages)."""

    top_k: int = Field(default=5, ge=1, le=20)


class ConversationAiSuggestResponse(BaseModel):
    conversation_id: str
    suggested_reply: str
    sources: list[AiAnswerSource]
    retrieved_count: int
    used_generation: bool = False
    customer_message_id: str | None = None
