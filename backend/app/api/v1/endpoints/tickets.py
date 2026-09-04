"""Ticket management API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DEFAULT_LIST_PAGE, DEFAULT_LIST_PAGE_SIZE, PageParam, PageSizeParam
from app.auth.deps import get_current_user, get_current_workspace
from app.schemas.auth import UserResponse
from app.schemas.pagination import PaginatedResponse
from app.schemas.ticket import (
    TicketCreateRequest,
    TicketPriority,
    TicketResponse,
    TicketStatus,
    TicketUpdateRequest,
)
from app.services import ticket_service
from app.services.workspace_service import WorkspaceContext

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("", response_model=PaginatedResponse[TicketResponse])
async def list_tickets(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
    q: Annotated[
        str | None,
        Query(max_length=200, description="Search title or description"),
    ] = None,
    ticket_status: Annotated[
        TicketStatus | None,
        Query(alias="status", description="Filter by ticket status"),
    ] = None,
    priority: Annotated[
        TicketPriority | None,
        Query(description="Filter by ticket priority"),
    ] = None,
    assignee_id: Annotated[
        str | None,
        Query(max_length=100, description="Filter by assignee user id"),
    ] = None,
    unassigned: Annotated[
        bool,
        Query(description="When true, only tickets with no assignee"),
    ] = False,
    customer_id: Annotated[
        str | None,
        Query(max_length=100, description="Filter by customer id"),
    ] = None,
    page: PageParam = DEFAULT_LIST_PAGE,
    page_size: PageSizeParam = DEFAULT_LIST_PAGE_SIZE,
) -> PaginatedResponse[TicketResponse]:
    return await ticket_service.list_tickets(
        current_workspace.id,
        owner_id=current_user.id,
        query=q,
        status_filter=ticket_status,
        priority_filter=priority,
        assignee_id=assignee_id,
        unassigned=unassigned,
        customer_id=customer_id,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket(
    payload: TicketCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> TicketResponse:
    return await ticket_service.create_ticket(
        workspace_id=current_workspace.id,
        owner_id=current_user.id,
        payload=payload,
    )


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> TicketResponse:
    return await ticket_service.get_ticket(
        ticket_id,
        current_workspace.id,
        owner_id=current_user.id,
    )


@router.patch("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    payload: TicketUpdateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> TicketResponse:
    return await ticket_service.update_ticket(
        ticket_id,
        current_workspace.id,
        payload,
        owner_id=current_user.id,
    )


@router.delete(
    "/{ticket_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_ticket(
    ticket_id: str,
    current_workspace: Annotated[WorkspaceContext, Depends(get_current_workspace)],
) -> Response:
    await ticket_service.delete_ticket(ticket_id, current_workspace.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
