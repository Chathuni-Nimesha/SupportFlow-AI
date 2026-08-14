"""Knowledge document API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth.deps import get_current_user
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
from app.services import knowledge_service
from app.services.knowledge_retrieval import normalize_top_k, retrieve_knowledge

router = APIRouter(prefix="/knowledge-documents", tags=["knowledge-documents"])
search_router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeDocumentResponse])
async def list_knowledge_documents(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> list[KnowledgeDocumentResponse]:
    return await knowledge_service.list_knowledge_documents(current_user.id)


@router.post(
    "",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_knowledge_document(
    payload: KnowledgeDocumentCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> KnowledgeDocumentResponse:
    return await knowledge_service.create_knowledge_document(
        current_user.id,
        payload,
    )


@router.get("/{document_id}", response_model=KnowledgeDocumentResponse)
async def get_knowledge_document(
    document_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> KnowledgeDocumentResponse:
    return await knowledge_service.get_knowledge_document(
        document_id,
        current_user.id,
    )


@router.patch("/{document_id}", response_model=KnowledgeDocumentResponse)
async def update_knowledge_document(
    document_id: str,
    payload: KnowledgeDocumentUpdateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> KnowledgeDocumentResponse:
    return await knowledge_service.update_knowledge_document(
        document_id,
        current_user.id,
        payload,
    )


@router.post(
    "/{document_id}/ingest",
    response_model=KnowledgeIngestionResponse,
)
async def ingest_knowledge_document(
    document_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> KnowledgeIngestionResponse:
    return await knowledge_service.ingest_knowledge_document(
        document_id,
        current_user.id,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_knowledge_document(
    document_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> Response:
    await knowledge_service.delete_knowledge_document(
        document_id,
        current_user.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@search_router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(
    payload: KnowledgeSearchRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> KnowledgeSearchResponse:
    """Search the authenticated user's published knowledge chunks."""
    top_k = normalize_top_k(payload.top_k)
    try:
        hits = await retrieve_knowledge(
            owner_id=current_user.id,
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
