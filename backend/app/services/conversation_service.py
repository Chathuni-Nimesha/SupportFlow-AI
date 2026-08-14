"""Conversation and message business logic."""

from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import PyMongoError

from app.core.logging import get_logger
from app.database.mongodb import get_database
from app.models.conversation import (
    CONVERSATIONS_COLLECTION,
    build_conversation_document,
    serialize_conversation,
    utc_now,
)
from app.models.message import (
    MESSAGES_COLLECTION,
    build_message_document,
    serialize_message,
)
from app.schemas.conversation import (
    ConversationCreateRequest,
    ConversationMessageCreateRequest,
    ConversationMessageResponse,
    ConversationResponse,
    ConversationUpdateRequest,
)

logger = get_logger(__name__)


def _get_collection(name: str):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc
    return db[name]


def _conversations():
    return _get_collection(CONVERSATIONS_COLLECTION)


def _messages():
    return _get_collection(MESSAGES_COLLECTION)


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


async def _get_owned_conversation(
    conversation_id: str,
    owner_id: str,
) -> dict[str, Any]:
    if not conversation_id or not conversation_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid conversation id.",
        )

    try:
        document = await _conversations().find_one(
            {"_id": conversation_id, "owner_id": owner_id},
        )
    except PyMongoError as exc:
        raise _db_error("fetch conversation", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return document


async def list_conversations(owner_id: str) -> list[ConversationResponse]:
    try:
        cursor = (
            _conversations()
            .find({"owner_id": owner_id})
            .sort("updated_at", -1)
        )
        documents = await cursor.to_list(length=500)
    except PyMongoError as exc:
        raise _db_error("list conversations", exc) from exc

    return [
        ConversationResponse.model_validate(serialize_conversation(doc))
        for doc in documents
    ]


async def get_conversation(
    conversation_id: str,
    owner_id: str,
) -> ConversationResponse:
    document = await _get_owned_conversation(conversation_id, owner_id)
    return ConversationResponse.model_validate(serialize_conversation(document))


async def create_conversation(
    owner_id: str,
    payload: ConversationCreateRequest,
) -> ConversationResponse:
    document = build_conversation_document(
        owner_id=owner_id,
        customer_name=payload.customer_name,
        customer_email=str(payload.customer_email),
        subject=payload.subject,
        channel=payload.channel,
        status=payload.status,
        assigned_agent_id=payload.assigned_agent_id,
        unread_count=payload.unread_count,
    )

    if payload.initial_message:
        message = build_message_document(
            conversation_id=document["_id"],
            owner_id=owner_id,
            sender_type="customer",
            content=payload.initial_message,
            sender_name=payload.customer_name,
        )
        document["last_message"] = message["content"]
        document["updated_at"] = message["created_at"]

    try:
        await _conversations().insert_one(document)
        if payload.initial_message:
            await _messages().insert_one(message)
    except PyMongoError as exc:
        raise _db_error("create conversation", exc) from exc

    return ConversationResponse.model_validate(serialize_conversation(document))


async def update_conversation(
    conversation_id: str,
    owner_id: str,
    payload: ConversationUpdateRequest,
) -> ConversationResponse:
    await _get_owned_conversation(conversation_id, owner_id)

    updates = payload.model_dump(exclude_unset=True)
    if "customer_email" in updates and updates["customer_email"] is not None:
        updates["customer_email"] = str(updates["customer_email"]).strip().lower()
    if "customer_name" in updates and updates["customer_name"] is not None:
        updates["customer_name"] = updates["customer_name"].strip()
    if "subject" in updates and updates["subject"] is not None:
        updates["subject"] = updates["subject"].strip()

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    updates["updated_at"] = utc_now()

    try:
        await _conversations().update_one(
            {"_id": conversation_id, "owner_id": owner_id},
            {"$set": updates},
        )
        document = await _conversations().find_one(
            {"_id": conversation_id, "owner_id": owner_id},
        )
    except PyMongoError as exc:
        raise _db_error("update conversation", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return ConversationResponse.model_validate(serialize_conversation(document))


async def list_messages(
    conversation_id: str,
    owner_id: str,
) -> list[ConversationMessageResponse]:
    await _get_owned_conversation(conversation_id, owner_id)

    try:
        cursor = (
            _messages()
            .find({"conversation_id": conversation_id, "owner_id": owner_id})
            .sort("created_at", 1)
        )
        documents = await cursor.to_list(length=2000)
    except PyMongoError as exc:
        raise _db_error("list messages", exc) from exc

    return [
        ConversationMessageResponse.model_validate(serialize_message(doc))
        for doc in documents
    ]


async def add_message(
    conversation_id: str,
    owner_id: str,
    payload: ConversationMessageCreateRequest,
) -> ConversationMessageResponse:
    await _get_owned_conversation(conversation_id, owner_id)

    message = build_message_document(
        conversation_id=conversation_id,
        owner_id=owner_id,
        sender_type=payload.sender_type,
        content=payload.content,
        sender_name=payload.sender_name,
    )

    try:
        await _messages().insert_one(message)
        update_ops: dict[str, Any] = {
            "$set": {
                "last_message": message["content"],
                "updated_at": message["created_at"],
            },
        }
        if payload.sender_type == "customer":
            update_ops["$inc"] = {"unread_count": 1}
        await _conversations().update_one(
            {"_id": conversation_id, "owner_id": owner_id},
            update_ops,
        )
    except PyMongoError as exc:
        raise _db_error("add message", exc) from exc

    return ConversationMessageResponse.model_validate(serialize_message(message))
