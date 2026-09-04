"""Customer directory API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DEFAULT_LIST_PAGE, DEFAULT_LIST_PAGE_SIZE, PageParam, PageSizeParam
from app.auth.deps import get_current_user, get_current_workspace
from app.schemas.auth import UserResponse
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerResponse,
    CustomerUpdateRequest,
)
from app.schemas.pagination import PaginatedResponse
from app.services import customer_service
from app.services.workspace_service import WorkspaceContext

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=PaginatedResponse[CustomerResponse])
async def list_customers(
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search name, email, or company"),
    ] = None,
    page: PageParam = DEFAULT_LIST_PAGE,
    page_size: PageSizeParam = DEFAULT_LIST_PAGE_SIZE,
) -> PaginatedResponse[CustomerResponse]:
    return await customer_service.list_customers(
        current_workspace.id,
        query=q,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_customer(
    payload: CustomerCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> CustomerResponse:
    return await customer_service.create_customer(
        workspace_id=current_workspace.id,
        owner_id=current_user.id,
        payload=payload,
    )


@router.get("/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> CustomerDetailResponse:
    return await customer_service.get_customer(
        customer_id,
        current_workspace.id,
    )


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdateRequest,
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> CustomerResponse:
    return await customer_service.update_customer(
        customer_id,
        current_workspace.id,
        payload,
    )


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_customer(
    customer_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> Response:
    await customer_service.delete_customer(customer_id, current_workspace.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
