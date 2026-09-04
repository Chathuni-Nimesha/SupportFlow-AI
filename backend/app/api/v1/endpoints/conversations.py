"""Conversation and message API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DEFAULT_LIST_PAGE, DEFAULT_LIST_PAGE_SIZE, PageParam, PageSizeParam
from app.auth.deps import get_current_user, get_current_workspace
from app.core.rate_limit import enforce_ai_rate_limit
from app.schemas.ai import (
    AiAnswerSource,
    ConversationAiSuggestRequest,
    ConversationAiSuggestResponse,
)
from app.schemas.auth import UserResponse
from app.schemas.conversation import (
    ConversationCreateRequest,
    ConversationMessageCreateRequest,
    ConversationMessageResponse,
    ConversationResponse,
    ConversationUpdateRequest,
)
from app.schemas.pagination import PaginatedResponse
from app.services import conversation_service
from app.services.conversation_ai_service import (
    ConversationAiValidationError,
    suggest_reply,
)
from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
    GeminiValidationError,
)
from app.services.rag_service import RagRetrievalError, RagValidationError
from app.services.workspace_service import WorkspaceContext

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=PaginatedResponse[ConversationResponse])
async def list_conversations(
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    page: PageParam = DEFAULT_LIST_PAGE,
    page_size: PageSizeParam = DEFAULT_LIST_PAGE_SIZE,
) -> PaginatedResponse[ConversationResponse]:
    return await conversation_service.list_conversations(
        current_workspace.id,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> ConversationResponse:
    return await conversation_service.create_conversation(
        workspace_id=current_workspace.id,
        owner_id=current_user.id,
        payload=payload,
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> ConversationResponse:
    return await conversation_service.get_conversation(
        conversation_id,
        current_workspace.id,
    )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> ConversationResponse:
    return await conversation_service.update_conversation(
        conversation_id,
        current_workspace.id,
        payload,
        owner_id=current_user.id,
    )


@router.get(
    "/{conversation_id}/messages",
    response_model=list[ConversationMessageResponse],
)
async def list_messages(
    conversation_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> list[ConversationMessageResponse]:
    return await conversation_service.list_messages(
        conversation_id,
        current_workspace.id,
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=ConversationMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_message(
    conversation_id: str,
    payload: ConversationMessageCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> ConversationMessageResponse:
    return await conversation_service.add_message(
        conversation_id,
        current_workspace.id,
        payload,
        owner_id=current_user.id,
    )


@router.post(
    "/{conversation_id}/ai/suggest",
    response_model=ConversationAiSuggestResponse,
)
async def suggest_ai_reply(
    conversation_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    payload: ConversationAiSuggestRequest | None = None,
) -> ConversationAiSuggestResponse:
    """
    Generate an AI suggested reply from the latest customer message (RAG).

    Suggestion only — does not create or send a conversation message.
    """
    request = payload or ConversationAiSuggestRequest()
    enforce_ai_rate_limit(
        user_id=current_user.id,
        workspace_id=current_workspace.id,
    )

    try:
        result = await suggest_reply(
            conversation_id=conversation_id,
            workspace_id=current_workspace.id,
            top_k=request.top_k,
        )
    except ConversationAiValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
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

    return ConversationAiSuggestResponse(
        conversation_id=result["conversation_id"],
        suggested_reply=result["suggested_reply"],
        sources=[
            AiAnswerSource.model_validate(source) for source in result["sources"]
        ],
        retrieved_count=result["retrieved_count"],
        used_generation=result["used_generation"],
        customer_message_id=result.get("customer_message_id"),
    )
