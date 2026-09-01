"""RAG orchestration: retrieve knowledge → build context → generate answer."""

from __future__ import annotations

from typing import Any

from app.core.logging import get_logger
from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
    GeminiValidationError,
    generate_grounded_answer,
)
from app.services.knowledge_retrieval import normalize_top_k, retrieve_knowledge

logger = get_logger(__name__)

INSUFFICIENT_KNOWLEDGE_ANSWER = (
    "I don't have enough information in the knowledge base to answer that question."
)

MAX_QUESTION_LENGTH = 4000


class RagValidationError(Exception):
    """Raised when RAG inputs are invalid."""


class RagRetrievalError(Exception):
    """Raised when knowledge retrieval fails."""


def _validate_question(question: str) -> str:
    cleaned = (question or "").strip()
    if not cleaned:
        raise RagValidationError("Question must not be empty.")
    if len(cleaned) > MAX_QUESTION_LENGTH:
        raise RagValidationError("Question is too long.")
    return cleaned


def build_context_from_hits(hits: list[dict[str, Any]]) -> str:
    """Combine retrieved chunks into a single grounded context string."""
    sections: list[str] = []
    for index, hit in enumerate(hits, start=1):
        metadata = hit.get("metadata") or {}
        title = str(metadata.get("title") or "Untitled").strip()
        document_id = str(metadata.get("document_id") or "").strip()
        source = str(metadata.get("source") or "").strip()
        text = str(hit.get("document") or "").strip()
        if not text:
            continue

        header_parts = [f"[{index}] Title: {title}"]
        if document_id:
            header_parts.append(f"Document ID: {document_id}")
        if source:
            header_parts.append(f"Source: {source}")
        sections.append("\n".join(header_parts) + f"\nContent:\n{text}")

    return "\n\n".join(sections).strip()


def build_sources_from_hits(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Build source citations from retrieval hits.

    Deduplicate by document_id, keeping the best (highest) score when available.
    """
    best_by_document: dict[str, dict[str, Any]] = {}
    fallback_sources: list[dict[str, Any]] = []

    for hit in hits:
        metadata = dict(hit.get("metadata") or {})
        document_id = str(metadata.get("document_id") or "").strip()
        source = {
            "document_id": document_id or None,
            "title": (str(metadata.get("title")).strip() if metadata.get("title") else None),
            "source": (
                str(metadata.get("source")).strip() if metadata.get("source") else None
            ),
            "chunk_id": hit.get("id"),
            "score": hit.get("score"),
            "distance": hit.get("distance"),
            "metadata": metadata,
        }

        if not document_id:
            fallback_sources.append(source)
            continue

        existing = best_by_document.get(document_id)
        if existing is None:
            best_by_document[document_id] = source
            continue

        existing_score = existing.get("score")
        new_score = source.get("score")
        if existing_score is None and new_score is not None:
            best_by_document[document_id] = source
        elif (
            isinstance(existing_score, (int, float))
            and isinstance(new_score, (int, float))
            and new_score > existing_score
        ):
            best_by_document[document_id] = source

    return list(best_by_document.values()) + fallback_sources


async def answer_with_rag(
    *,
    owner_id: str,
    question: str,
    top_k: int = 5,
) -> dict[str, Any]:
    """
    Orchestrate retrieval + grounded generation for one owner-scoped question.

    Does not invent knowledge. If nothing is retrieved, returns a safe
    insufficient-knowledge answer without calling Gemini.
    """
    cleaned_owner = (owner_id or "").strip()
    if not cleaned_owner:
        raise RagValidationError("Owner id is required.")

    cleaned_question = _validate_question(question)
    safe_top_k = normalize_top_k(top_k)

    try:
        hits = await retrieve_knowledge(
            owner_id=cleaned_owner,
            query=cleaned_question,
            top_k=safe_top_k,
        )
    except Exception as exc:
        logger.exception("RAG retrieval failed for owner_id=%s", cleaned_owner)
        raise RagRetrievalError(
            "Knowledge retrieval failed. Please try again later.",
        ) from exc

    sources = build_sources_from_hits(hits)
    retrieved_count = len(hits)

    if retrieved_count == 0:
        return {
            "answer": INSUFFICIENT_KNOWLEDGE_ANSWER,
            "sources": [],
            "retrieved_count": 0,
            "used_generation": False,
        }

    context = build_context_from_hits(hits)
    if not context:
        return {
            "answer": INSUFFICIENT_KNOWLEDGE_ANSWER,
            "sources": [],
            "retrieved_count": 0,
            "used_generation": False,
        }

    try:
        answer = await generate_grounded_answer(
            question=cleaned_question,
            context=context,
        )
    except (GeminiConfigurationError, GeminiProviderError, GeminiValidationError):
        raise
    except Exception as exc:
        # Do not log str(exc)/traceback: unexpected errors can include provider details.
        logger.error("Gemini generation failed")
        raise GeminiProviderError(
            "Answer generation failed. Please try again later.",
        ) from exc

    return {
        "answer": answer,
        "sources": sources,
        "retrieved_count": retrieved_count,
        "used_generation": True,
    }
