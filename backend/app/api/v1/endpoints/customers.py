"""Customer directory API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.deps import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerResponse,
    CustomerUpdateRequest,
)
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerResponse])
async def list_customers(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search name, email, or company"),
    ] = None,
) -> list[CustomerResponse]:
    return await customer_service.list_customers(current_user.id, query=q)


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_customer(
    payload: CustomerCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> CustomerResponse:
    return await customer_service.create_customer(current_user.id, payload)


@router.get("/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> CustomerDetailResponse:
    return await customer_service.get_customer(customer_id, current_user.id)


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> CustomerResponse:
    return await customer_service.update_customer(
        customer_id,
        current_user.id,
        payload,
    )


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_customer(
    customer_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> Response:
    await customer_service.delete_customer(customer_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
