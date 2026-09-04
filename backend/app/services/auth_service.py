"""Authentication business logic."""

from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database.mongodb import get_database
from app.models.user import (
    USERS_COLLECTION,
    build_user_document,
)
from app.schemas.auth import (
    AuthTokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services import workspace_service

logger = get_logger(__name__)


def _users_collection():
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc
    return db[USERS_COLLECTION]


async def register_user(payload: UserRegisterRequest) -> UserResponse:
    collection = _users_collection()
    email = payload.email.strip().lower()

    try:
        existing = await collection.find_one({"email": email})
    except PyMongoError as exc:
        logger.exception("Failed to query users during registration")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    document = build_user_document(
        first_name=payload.first_name,
        last_name=payload.last_name,
        company_name=payload.company_name,
        email=email,
        password_hash=hash_password(payload.password),
    )

    try:
        await collection.insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc
    except PyMongoError as exc:
        logger.exception("Failed to insert user during registration")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc

    try:
        await workspace_service.provision_personal_workspace(document)
    except HTTPException:
        await workspace_service.compensate_failed_registration(str(document["_id"]))
        raise
    except Exception:
        logger.exception("Failed to provision workspace during registration")
        await workspace_service.compensate_failed_registration(str(document["_id"]))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        )

    return await workspace_service.build_user_response(document)


async def authenticate_user(payload: UserLoginRequest) -> AuthTokenResponse:
    collection = _users_collection()
    email = payload.email.strip().lower()

    try:
        document = await collection.find_one({"email": email})
    except PyMongoError as exc:
        logger.exception("Failed to query users during login")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc

    if document is None or not verify_password(
        payload.password,
        document["password_hash"],
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not document.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive.",
        )

    token = create_access_token(subject=str(document["_id"]))
    user = await workspace_service.build_user_response(document)
    return AuthTokenResponse(access_token=token, user=user)


async def get_user_by_id(user_id: str) -> dict[str, Any]:
    collection = _users_collection()
    try:
        document = await collection.find_one({"_id": user_id})
    except PyMongoError as exc:
        logger.exception("Failed to fetch user by id")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not document.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive.",
        )

    return document
