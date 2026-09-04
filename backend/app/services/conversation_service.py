"""Conversation and message business logic."""

from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import PyMongoError

from app.core.logging import get_logger
from app.core.pagination import paginate_find, paginated_payload
from app.database.mongodb import get_database
from app.models.conversation import (
    CONVERSATIONS_COLLECTION,
    build_conversation_document,
    serialize_conversation,
    utc_now,
)
from app.models.customer import CUSTOMERS_COLLECTION
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
from app.services import team_service

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


def _customers():
    return _get_collection(CUSTOMERS_COLLECTION)


def _messages():
    return _get_collection(MESSAGES_COLLECTION)


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


def _require_id(value: str, label: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}.",
        )
    return cleaned


def _conversation_filter(conversation_id: str, workspace_id: str) -> dict[str, str]:
    return {"_id": conversation_id, "workspace_id": workspace_id}


async def _get_workspace_customer(
    customer_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    customer_id = _require_id(customer_id, "customer id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _customers().find_one(
            {"_id": customer_id, "workspace_id": workspace_id},
        )
    except PyMongoError as exc:
        raise _db_error("fetch customer for conversation", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return document


async def _lookup_workspace_customer_by_email(
    workspace_id: str,
    email: str,
) -> str | None:
    workspace_id = _require_id(workspace_id, "workspace id")
    normalized_email = str(email or "").strip().lower()
    if not normalized_email:
        return None

    try:
        documents = await (
            _customers()
            .find({"workspace_id": workspace_id, "email": normalized_email})
            .to_list(length=2)
        )
    except PyMongoError as exc:
        raise _db_error("lookup customer for conversation", exc) from exc

    if len(documents) != 1:
        return None
    return str(documents[0]["_id"])


async def _resolve_create_customer_id(
    *,
    workspace_id: str,
    customer_id: str | None,
    customer_email: str,
) -> str | None:
    if customer_id:
        customer = await _get_workspace_customer(customer_id, workspace_id)
        return str(customer["_id"])
    return await _lookup_workspace_customer_by_email(workspace_id, customer_email)


async def _get_workspace_conversation(
    conversation_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    conversation_id = _require_id(conversation_id, "conversation id")
    workspace_id = _require_id(workspace_id, "workspace id")

    try:
        document = await _conversations().find_one(
            _conversation_filter(conversation_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("fetch conversation", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return document


async def list_conversations(
    workspace_id: str,
    *,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    workspace_id = _require_id(workspace_id, "workspace id")
    try:
        documents, total = await paginate_find(
            _conversations(),
            {"workspace_id": workspace_id},
            page=page,
            page_size=page_size,
        )
    except PyMongoError as exc:
        raise _db_error("list conversations", exc) from exc

    items = [
        ConversationResponse.model_validate(serialize_conversation(doc))
        for doc in documents
    ]
    return paginated_payload(
        items,
        page=page,
        page_size=page_size,
        total=total,
    )


async def get_conversation(
    conversation_id: str,
    workspace_id: str,
) -> ConversationResponse:
    document = await _get_workspace_conversation(conversation_id, workspace_id)
    return ConversationResponse.model_validate(serialize_conversation(document))


async def create_conversation(
    *,
    workspace_id: str,
    owner_id: str,
    payload: ConversationCreateRequest,
) -> ConversationResponse:
    workspace_id = _require_id(workspace_id, "workspace id")
    assigned_agent_id = await team_service.require_assignable_member(
        payload.assigned_agent_id,
        workspace_id,
        owner_id=owner_id,
    )
    customer_id = await _resolve_create_customer_id(
        workspace_id=workspace_id,
        customer_id=payload.customer_id,
        customer_email=str(payload.customer_email),
    )
    document = build_conversation_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customer_id=customer_id,
        customer_name=payload.customer_name,
        customer_email=str(payload.customer_email),
        subject=payload.subject,
        channel=payload.channel,
        status=payload.status,
        assigned_agent_id=assigned_agent_id,
        unread_count=payload.unread_count,
    )

    if payload.initial_message:
        message = build_message_document(
            conversation_id=document["_id"],
            owner_id=owner_id,
            workspace_id=workspace_id,
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
    workspace_id: str,
    payload: ConversationUpdateRequest,
    *,
    owner_id: str,
) -> ConversationResponse:
    await _get_workspace_conversation(conversation_id, workspace_id)
    conversation_id = _require_id(conversation_id, "conversation id")
    workspace_id = _require_id(workspace_id, "workspace id")

    updates = payload.model_dump(exclude_unset=True)
    updates.pop("workspace_id", None)
    updates.pop("owner_id", None)
    if "assigned_agent_id" in updates:
        updates["assigned_agent_id"] = await team_service.require_assignable_member(
            updates["assigned_agent_id"],
            workspace_id,
            owner_id=owner_id,
        )
    unset_fields: dict[str, str] = {}
    if "customer_id" in updates:
        requested_customer_id = updates.pop("customer_id")
        if requested_customer_id is None:
            unset_fields["customer_id"] = ""
        else:
            customer = await _get_workspace_customer(
                requested_customer_id,
                workspace_id,
            )
            updates["customer_id"] = str(customer["_id"])
    if "customer_email" in updates and updates["customer_email"] is not None:
        updates["customer_email"] = str(updates["customer_email"]).strip().lower()
    if "customer_name" in updates and updates["customer_name"] is not None:
        updates["customer_name"] = updates["customer_name"].strip()
    if "subject" in updates and updates["subject"] is not None:
        updates["subject"] = updates["subject"].strip()

    if not updates and not unset_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    updates["updated_at"] = utc_now()
    operations: dict[str, Any] = {"$set": updates}
    if unset_fields:
        operations["$unset"] = unset_fields
    tenant_filter = _conversation_filter(conversation_id, workspace_id)

    try:
        await _conversations().update_one(
            tenant_filter,
            operations,
        )
        document = await _conversations().find_one(tenant_filter)
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
    workspace_id: str,
) -> list[ConversationMessageResponse]:
    document = await _get_workspace_conversation(conversation_id, workspace_id)
    conversation_id = str(document["_id"])

    try:
        cursor = (
            _messages()
            .find({"conversation_id": conversation_id})
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
    workspace_id: str,
    payload: ConversationMessageCreateRequest,
    *,
    owner_id: str,
) -> ConversationMessageResponse:
    await _get_workspace_conversation(conversation_id, workspace_id)
    conversation_id = _require_id(conversation_id, "conversation id")
    workspace_id = _require_id(workspace_id, "workspace id")

    message = build_message_document(
        conversation_id=conversation_id,
        owner_id=owner_id,
        workspace_id=workspace_id,
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
            _conversation_filter(conversation_id, workspace_id),
            update_ops,
        )
    except PyMongoError as exc:
        raise _db_error("add message", exc) from exc

    return ConversationMessageResponse.model_validate(serialize_message(message))
