"""AI / RAG API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.deps import get_current_user, get_current_workspace
from app.core.rate_limit import enforce_ai_rate_limit
from app.schemas.ai import AiAnswerRequest, AiAnswerResponse, AiAnswerSource
from app.schemas.auth import UserResponse
from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
    GeminiValidationError,
)
from app.services.rag_service import (
    RagRetrievalError,
    RagValidationError,
    answer_with_rag,
)
from app.services.workspace_service import WorkspaceContext

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/answer", response_model=AiAnswerResponse)
async def generate_ai_answer(
    payload: AiAnswerRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> AiAnswerResponse:
    """
    Answer a question using workspace-scoped published knowledge (RAG).

    Retrieval + grounded generation. Does not invent knowledge when nothing
    is retrieved.
    """
    enforce_ai_rate_limit(
        user_id=current_user.id,
        workspace_id=current_workspace.id,
    )
    try:
        result = await answer_with_rag(
            workspace_id=current_workspace.id,
            question=payload.question,
            top_k=payload.top_k,
        )
    except RagValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RagRetrievalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except GeminiConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except GeminiValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except GeminiProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return AiAnswerResponse(
        answer=result["answer"],
        sources=[AiAnswerSource.model_validate(source) for source in result["sources"]],
        retrieved_count=result["retrieved_count"],
        used_generation=result["used_generation"],
    )
