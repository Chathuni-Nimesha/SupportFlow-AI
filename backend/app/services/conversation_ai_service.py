"""Conversation AI suggestions — thin orchestration over existing RAG."""

from __future__ import annotations

from typing import Any

from app.schemas.conversation import ConversationMessageResponse
from app.services import conversation_service
from app.services.rag_service import answer_with_rag


class ConversationAiValidationError(Exception):
    """Raised when a conversation cannot produce an AI suggestion."""


def find_latest_customer_message(
    messages: list[ConversationMessageResponse],
) -> ConversationMessageResponse | None:
    """
    Return the most recent customer message with non-empty content.

    Messages are expected in chronological order (oldest → newest).
    Agent and AI messages are ignored.
    """
    for message in reversed(messages):
        if message.sender_type != "customer":
            continue
        if not (message.content or "").strip():
            continue
        return message
    return None


async def suggest_reply(
    *,
    conversation_id: str,
    workspace_id: str,
    top_k: int = 5,
) -> dict[str, Any]:
    """
    Build an AI suggested reply for a conversation using workspace-scoped RAG.

    Conversation/message access and knowledge retrieval both use workspace_id.

    Does not create messages, update conversation status, or send replies.
    """
    messages = await conversation_service.list_messages(
        conversation_id,
        workspace_id,
    )
    customer_message = find_latest_customer_message(messages)
    if customer_message is None:
        raise ConversationAiValidationError(
            "No customer message available to generate a suggestion.",
        )

    rag_result = await answer_with_rag(
        workspace_id=workspace_id,
        question=customer_message.content,
        top_k=top_k,
    )

    return {
        "conversation_id": conversation_id,
        "suggested_reply": rag_result["answer"],
        "sources": rag_result["sources"],
        "retrieved_count": rag_result["retrieved_count"],
        "used_generation": rag_result["used_generation"],
        "customer_message_id": customer_message.id,
    }
