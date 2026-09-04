"""Knowledge document API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import DEFAULT_LIST_PAGE, DEFAULT_LIST_PAGE_SIZE, PageParam, PageSizeParam
from app.auth.deps import (
    get_current_user,
    get_current_workspace,
    require_knowledge_manager,
)
from app.core.rate_limit import enforce_search_rate_limit
from app.schemas.auth import UserResponse
from app.schemas.knowledge import (
    KnowledgeDocumentCreateRequest,
    KnowledgeDocumentResponse,
    KnowledgeDocumentUpdateRequest,
    KnowledgeIngestionResponse,
    KnowledgeSearchHit,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)
from app.schemas.pagination import PaginatedResponse
from app.services import knowledge_service
from app.services.knowledge_retrieval import normalize_top_k, retrieve_knowledge
from app.services.workspace_service import WorkspaceContext

router = APIRouter(prefix="/knowledge-documents", tags=["knowledge-documents"])
search_router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("", response_model=PaginatedResponse[KnowledgeDocumentResponse])
async def list_knowledge_documents(
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    page: PageParam = DEFAULT_LIST_PAGE,
    page_size: PageSizeParam = DEFAULT_LIST_PAGE_SIZE,
) -> PaginatedResponse[KnowledgeDocumentResponse]:
    return await knowledge_service.list_knowledge_documents(
        current_workspace.id,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_knowledge_document(
    payload: KnowledgeDocumentCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(require_knowledge_manager)],
) -> KnowledgeDocumentResponse:
    return await knowledge_service.create_knowledge_document(
        workspace_id=current_workspace.id,
        owner_id=current_user.id,
        payload=payload,
    )


@router.get("/{document_id}", response_model=KnowledgeDocumentResponse)
async def get_knowledge_document(
    document_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> KnowledgeDocumentResponse:
    return await knowledge_service.get_knowledge_document(
        document_id,
        current_workspace.id,
    )


@router.patch("/{document_id}", response_model=KnowledgeDocumentResponse)
async def update_knowledge_document(
    document_id: str,
    payload: KnowledgeDocumentUpdateRequest,
    current_workspace: Annotated[WorkspaceContext, Depends(require_knowledge_manager)],
) -> KnowledgeDocumentResponse:
    return await knowledge_service.update_knowledge_document(
        document_id,
        current_workspace.id,
        payload,
    )


@router.post(
    "/{document_id}/ingest",
    response_model=KnowledgeIngestionResponse,
)
async def ingest_knowledge_document(
    document_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(require_knowledge_manager)],
) -> KnowledgeIngestionResponse:
    return await knowledge_service.ingest_knowledge_document(
        document_id,
        current_workspace.id,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_knowledge_document(
    document_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(require_knowledge_manager)],
) -> Response:
    await knowledge_service.delete_knowledge_document(
        document_id,
        current_workspace.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@search_router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(
    payload: KnowledgeSearchRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> KnowledgeSearchResponse:
    """Search the current workspace's published knowledge chunks."""
    enforce_search_rate_limit(
        user_id=current_user.id,
        workspace_id=current_workspace.id,
    )
    top_k = normalize_top_k(payload.top_k)
    try:
        hits = await retrieve_knowledge(
            workspace_id=current_workspace.id,
            query=payload.query,
            top_k=top_k,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Knowledge search unavailable. Please try again later.",
        ) from exc

    results = [KnowledgeSearchHit.model_validate(hit) for hit in hits]
    return KnowledgeSearchResponse(
        query=payload.query,
        top_k=top_k,
        count=len(results),
        results=results,
    )
