"""Authentication API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.auth.deps import get_current_user
from app.schemas.auth import (
    AuthTokenResponse,
    MessageResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(payload: UserRegisterRequest) -> UserResponse:
    return await auth_service.register_user(payload)


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: UserLoginRequest) -> AuthTokenResponse:
    return await auth_service.authenticate_user(payload)


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> UserResponse:
    return current_user


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> MessageResponse:
    # Stateless JWT: client must discard the token. No server-side session.
    _ = current_user
    return MessageResponse(
        message="Logged out successfully. Please discard the access token.",
    )
