"""Customer directory business logic."""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.logging import get_logger
from app.core.pagination import paginate_find, paginated_payload
from app.database.mongodb import get_database
from app.models.conversation import (
    CONVERSATIONS_COLLECTION,
    serialize_conversation,
)
from app.models.customer import (
    CUSTOMERS_COLLECTION,
    build_customer_document,
    serialize_customer,
    utc_now,
)
from app.schemas.conversation import ConversationResponse
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerResponse,
    CustomerUpdateRequest,
)

logger = get_logger(__name__)

_REGEX_SPECIAL = re.compile(r"[.^$*+?{}\[\]\\|()]")


def _get_collection(name: str):
    try:
        db = get_database()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Please try again later.",
        ) from exc
    return db[name]


def _customers():
    return _get_collection(CUSTOMERS_COLLECTION)


def _conversations():
    return _get_collection(CONVERSATIONS_COLLECTION)


def _db_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Failed to %s", action)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Please try again later.",
    )


def _escape_search(term: str) -> str:
    return _REGEX_SPECIAL.sub(lambda match: "\\" + match.group(0), term)


def _field_search_clause(pattern: str) -> dict[str, Any]:
    return {
        "$or": [
            {"first_name": {"$regex": pattern, "$options": "i"}},
            {"last_name": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
            {"company": {"$regex": pattern, "$options": "i"}},
        ]
    }


def _name_email_company_search(cleaned: str) -> dict[str, Any]:
    tokens = [token for token in cleaned.split() if token]
    clauses = [_field_search_clause(_escape_search(token)) for token in tokens]
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _require_customer_id(customer_id: str) -> str:
    cleaned = (customer_id or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid customer id.",
        )
    return cleaned


def _require_workspace_id(workspace_id: str) -> str:
    cleaned = (workspace_id or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid workspace id.",
        )
    return cleaned


def _customer_filter(customer_id: str, workspace_id: str) -> dict[str, str]:
    return {"_id": customer_id, "workspace_id": workspace_id}


async def _get_workspace_customer(
    customer_id: str,
    workspace_id: str,
) -> dict[str, Any]:
    customer_id = _require_customer_id(customer_id)
    workspace_id = _require_workspace_id(workspace_id)

    try:
        document = await _customers().find_one(
            _customer_filter(customer_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("fetch customer", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return document


async def _related_conversations(
    workspace_id: str,
    email: str,
) -> list[ConversationResponse]:
    workspace_id = _require_workspace_id(workspace_id)
    normalized_email = str(email or "").strip().lower()
    try:
        cursor = (
            _conversations()
            .find(
                {
                    "workspace_id": workspace_id,
                    "customer_email": normalized_email,
                },
            )
            .sort("updated_at", -1)
        )
        documents = await cursor.to_list(length=100)
    except PyMongoError as exc:
        raise _db_error("list customer conversations", exc) from exc

    return [
        ConversationResponse.model_validate(serialize_conversation(doc))
        for doc in documents
    ]


async def list_customers(
    workspace_id: str,
    query: str | None = None,
    *,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    workspace_id = _require_workspace_id(workspace_id)
    filters: dict[str, Any] = {"workspace_id": workspace_id}
    cleaned = (query or "").strip()
    if cleaned:
        filters.update(_name_email_company_search(cleaned))

    try:
        documents, total = await paginate_find(
            _customers(),
            filters,
            page=page,
            page_size=page_size,
        )
    except PyMongoError as exc:
        raise _db_error("list customers", exc) from exc

    items = [
        CustomerResponse.model_validate(serialize_customer(doc))
        for doc in documents
    ]
    return paginated_payload(
        items,
        page=page,
        page_size=page_size,
        total=total,
    )


async def get_customer(
    customer_id: str,
    workspace_id: str,
) -> CustomerDetailResponse:
    document = await _get_workspace_customer(customer_id, workspace_id)
    payload = serialize_customer(document)
    conversations = await _related_conversations(
        workspace_id,
        payload["email"],
    )
    return CustomerDetailResponse.model_validate(
        {**payload, "conversations": conversations},
    )


async def create_customer(
    *,
    workspace_id: str,
    owner_id: str,
    payload: CustomerCreateRequest,
) -> CustomerResponse:
    workspace_id = _require_workspace_id(workspace_id)
    document = build_customer_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email),
        phone=payload.phone,
        company=payload.company,
        notes=payload.notes,
    )

    try:
        await _customers().insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A customer with this email already exists in your workspace.",
        ) from exc
    except PyMongoError as exc:
        raise _db_error("create customer", exc) from exc

    return CustomerResponse.model_validate(serialize_customer(document))


async def update_customer(
    customer_id: str,
    workspace_id: str,
    payload: CustomerUpdateRequest,
) -> CustomerResponse:
    await _get_workspace_customer(customer_id, workspace_id)
    customer_id = _require_customer_id(customer_id)
    workspace_id = _require_workspace_id(workspace_id)

    updates = payload.model_dump(exclude_unset=True)
    updates.pop("workspace_id", None)
    updates.pop("owner_id", None)
    if "email" in updates and updates["email"] is not None:
        updates["email"] = str(updates["email"]).strip().lower()
    if "phone" in updates and updates["phone"] is not None:
        updates["phone"] = updates["phone"].strip() or None
    if "company" in updates and updates["company"] is not None:
        updates["company"] = updates["company"].strip() or None
    if "notes" in updates and updates["notes"] is not None:
        updates["notes"] = updates["notes"].strip() or None

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    updates["updated_at"] = utc_now()
    tenant_filter = _customer_filter(customer_id, workspace_id)

    try:
        await _customers().update_one(
            tenant_filter,
            {"$set": updates},
        )
        document = await _customers().find_one(tenant_filter)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A customer with this email already exists in your workspace.",
        ) from exc
    except PyMongoError as exc:
        raise _db_error("update customer", exc) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return CustomerResponse.model_validate(serialize_customer(document))


async def delete_customer(customer_id: str, workspace_id: str) -> None:
    await _get_workspace_customer(customer_id, workspace_id)
    customer_id = _require_customer_id(customer_id)
    workspace_id = _require_workspace_id(workspace_id)

    try:
        result = await _customers().delete_one(
            _customer_filter(customer_id, workspace_id),
        )
    except PyMongoError as exc:
        raise _db_error("delete customer", exc) from exc

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
