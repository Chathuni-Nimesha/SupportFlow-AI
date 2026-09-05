"""Phase 1A workspace schema tests. Runtime isolation uses workspace_id."""

from collections.abc import AsyncIterator

import pytest
from mongomock_motor import AsyncMongoMockClient
from pymongo.errors import DuplicateKeyError
from pydantic import ValidationError

from app.database import mongodb as mongodb_module
from app.database.indexes import ensure_indexes
from app.models.conversation import build_conversation_document, serialize_conversation
from app.models.customer import build_customer_document, serialize_customer
from app.models.knowledge import build_knowledge_document, serialize_knowledge_document
from app.models.message import build_message_document, serialize_message
from app.models.team_member import build_team_member_document, serialize_team_member
from app.models.ticket import build_ticket_document, serialize_ticket
from app.models.workspace import (
    WORKSPACES_COLLECTION,
    apply_optional_workspace_id,
    build_workspace_document,
    serialize_workspace,
)
from app.schemas.conversation import ConversationResponse
from app.schemas.customer import CustomerResponse
from app.schemas.knowledge import KnowledgeDocumentResponse
from app.schemas.team_member import TeamMemberResponse
from app.schemas.ticket import TicketResponse
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse


OWNER_ID = "user-owner-1"
WORKSPACE_ID = "workspace-1"


@pytest.fixture
async def indexed_db() -> AsyncIterator:
    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["supportflow_index_test"]
    previous_client = mongodb_module._client
    previous_db = mongodb_module._database
    mongodb_module._client = mock_client
    mongodb_module._database = mock_db
    try:
        await ensure_indexes()
        yield mock_db
    finally:
        mongodb_module._client = previous_client
        mongodb_module._database = previous_db


def test_build_workspace_document_uses_distinct_uuid() -> None:
    document = build_workspace_document(
        name="  Acme Support  ",
        owner_user_id=f"  {OWNER_ID}  ",
    )

    assert document["_id"] != OWNER_ID
    assert document["_id"] != document["owner_user_id"]
    assert document["name"] == "Acme Support"
    assert document["owner_user_id"] == OWNER_ID
    assert document["created_at"] is not None
    assert document["updated_at"] is not None


def test_build_workspace_document_rejects_id_equal_to_owner() -> None:
    with pytest.raises(ValueError, match="must not equal owner_user_id"):
        build_workspace_document(
            name="Acme Support",
            owner_user_id=OWNER_ID,
            workspace_id=OWNER_ID,
        )


def test_build_workspace_document_rejects_empty_name_and_owner() -> None:
    with pytest.raises(ValueError, match="name"):
        build_workspace_document(name="   ", owner_user_id=OWNER_ID)
    with pytest.raises(ValueError, match="owner_user_id"):
        build_workspace_document(name="Acme", owner_user_id="  ")


def test_serialize_workspace_and_response_schema() -> None:
    document = build_workspace_document(
        name="Acme Support",
        owner_user_id=OWNER_ID,
        workspace_id=WORKSPACE_ID,
    )
    payload = serialize_workspace(document)
    parsed = WorkspaceResponse.model_validate(payload)

    assert parsed.id == WORKSPACE_ID
    assert parsed.name == "Acme Support"
    assert parsed.owner_user_id == OWNER_ID
    assert payload["id"] == WORKSPACE_ID
    assert "owner_id" not in payload


def test_workspace_create_schema_strips_fields() -> None:
    payload = WorkspaceCreate.model_validate(
        {"name": "  Acme  ", "owner_user_id": f"  {OWNER_ID}  "},
    )
    assert payload.name == "Acme"
    assert payload.owner_user_id == OWNER_ID

    with pytest.raises(ValidationError):
        WorkspaceCreate.model_validate({"name": "   ", "owner_user_id": OWNER_ID})


def test_optional_workspace_id_omitted_when_blank() -> None:
    document = apply_optional_workspace_id({"owner_id": OWNER_ID}, None)
    assert "workspace_id" not in document

    document = apply_optional_workspace_id({"owner_id": OWNER_ID}, "  ")
    assert "workspace_id" not in document

    document = apply_optional_workspace_id({"owner_id": OWNER_ID}, WORKSPACE_ID)
    assert document["workspace_id"] == WORKSPACE_ID


def test_resource_builders_omit_workspace_id_by_default() -> None:
    conversation = build_conversation_document(
        owner_id=OWNER_ID,
        customer_name="Ada",
        customer_email="ada@example.com",
        subject="Help",
        channel="Chat",
    )
    message = build_message_document(
        conversation_id="conv-1",
        owner_id=OWNER_ID,
        sender_type="customer",
        content="Hello",
    )
    customer = build_customer_document(
        owner_id=OWNER_ID,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
    )
    ticket = build_ticket_document(
        owner_id=OWNER_ID,
        customer_id="cust-1",
        title="Outage",
        description="Site down",
    )
    member = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        role="AGENT",
    )
    knowledge = build_knowledge_document(
        owner_id=OWNER_ID,
        title="Refunds",
        content="Refunds take 5 days.",
    )

    for document in (conversation, message, customer, ticket, member, knowledge):
        assert document["owner_id"] == OWNER_ID
        assert "workspace_id" not in document
    assert "customer_id" not in conversation
    assert "conversation_id" not in ticket


def test_resource_builders_accept_optional_workspace_id() -> None:
    conversation = build_conversation_document(
        owner_id=OWNER_ID,
        customer_name="Ada",
        customer_email="ada@example.com",
        subject="Help",
        channel="Chat",
        workspace_id=WORKSPACE_ID,
    )
    message = build_message_document(
        conversation_id="conv-1",
        owner_id=OWNER_ID,
        sender_type="customer",
        content="Hello",
        workspace_id=WORKSPACE_ID,
    )
    customer = build_customer_document(
        owner_id=OWNER_ID,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        workspace_id=WORKSPACE_ID,
    )
    ticket = build_ticket_document(
        owner_id=OWNER_ID,
        customer_id="cust-1",
        title="Outage",
        description="Site down",
        workspace_id=WORKSPACE_ID,
    )
    member = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        role="AGENT",
        user_id=None,
        workspace_id=WORKSPACE_ID,
    )
    knowledge = build_knowledge_document(
        owner_id=OWNER_ID,
        title="Refunds",
        content="Refunds take 5 days.",
        workspace_id=WORKSPACE_ID,
    )

    for document in (conversation, message, customer, ticket, member, knowledge):
        assert document["owner_id"] == OWNER_ID
        assert document["workspace_id"] == WORKSPACE_ID


def test_serializers_keep_owner_id_and_optional_workspace_id() -> None:
    conversation = serialize_conversation(
        build_conversation_document(
            owner_id=OWNER_ID,
            customer_name="Ada",
            customer_email="ada@example.com",
            subject="Help",
            channel="Chat",
            workspace_id=WORKSPACE_ID,
        ),
    )
    customer = serialize_customer(
        build_customer_document(
            owner_id=OWNER_ID,
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            workspace_id=WORKSPACE_ID,
        ),
    )
    ticket = serialize_ticket(
        build_ticket_document(
            owner_id=OWNER_ID,
            customer_id="cust-1",
            title="Outage",
            description="Site down",
            workspace_id=WORKSPACE_ID,
        ),
    )
    member = serialize_team_member(
        build_team_member_document(
            owner_id=OWNER_ID,
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            role="OWNER",
            user_id=OWNER_ID,
            member_id=OWNER_ID,
            workspace_id=WORKSPACE_ID,
        ),
    )
    knowledge = serialize_knowledge_document(
        build_knowledge_document(
            owner_id=OWNER_ID,
            title="Refunds",
            content="Refunds take 5 days.",
            workspace_id=WORKSPACE_ID,
        ),
    )
    message = serialize_message(
        build_message_document(
            conversation_id="conv-1",
            owner_id=OWNER_ID,
            sender_type="agent",
            content="On it",
            workspace_id=WORKSPACE_ID,
        ),
    )

    ConversationResponse.model_validate(conversation)
    CustomerResponse.model_validate(customer)
    TicketResponse.model_validate(ticket)
    TeamMemberResponse.model_validate(member)
    KnowledgeDocumentResponse.model_validate(knowledge)

    assert customer["owner_id"] == OWNER_ID
    assert customer["workspace_id"] == WORKSPACE_ID
    assert ticket["owner_id"] == OWNER_ID
    assert ticket["workspace_id"] == WORKSPACE_ID
    assert conversation["owner_id"] == OWNER_ID
    assert conversation["workspace_id"] == WORKSPACE_ID
    assert knowledge["owner_id"] == OWNER_ID
    assert knowledge["workspace_id"] == WORKSPACE_ID
    assert member["owner_id"] == OWNER_ID
    assert member["workspace_id"] == WORKSPACE_ID

    assert "owner_id" not in message
    assert "workspace_id" not in message
    assert member["user_id"] == OWNER_ID
    assert member["id"] == OWNER_ID


@pytest.mark.asyncio
async def test_workspace_owner_user_id_index_is_unique(indexed_db) -> None:
    info = await indexed_db[WORKSPACES_COLLECTION].index_information()
    owner_index = None
    for spec in info.values():
        keys = spec.get("key") or []
        if keys == [("owner_user_id", 1)] or list(keys) == [("owner_user_id", 1)]:
            owner_index = spec
            break
    assert owner_index is not None
    assert owner_index.get("unique") is True

    collection = indexed_db[WORKSPACES_COLLECTION]
    first = build_workspace_document(name="Acme", owner_user_id=OWNER_ID)
    second = build_workspace_document(name="Acme East", owner_user_id=OWNER_ID)
    await collection.insert_one(first)
    with pytest.raises(DuplicateKeyError):
        await collection.insert_one(second)


@pytest.mark.asyncio
async def test_owner_id_indexes_are_preserved(indexed_db) -> None:
    conversations = await indexed_db.conversations.index_information()
    customers = await indexed_db.customers.index_information()
    tickets = await indexed_db.tickets.index_information()
    team_members = await indexed_db.team_members.index_information()
    knowledge = await indexed_db.knowledge_documents.index_information()

    def has_key(info: dict, expected: list[tuple]) -> bool:
        for spec in info.values():
            if list(spec.get("key") or []) == expected:
                return True
        return False

    assert has_key(conversations, [("owner_id", 1), ("updated_at", -1)])
    assert has_key(conversations, [("owner_id", 1), ("status", 1)])
    assert has_key(conversations, [("workspace_id", 1), ("updated_at", -1)])
    assert has_key(conversations, [("workspace_id", 1), ("status", 1)])
    assert has_key(conversations, [("workspace_id", 1), ("customer_id", 1)])
    assert has_key(conversations, [("workspace_id", 1), ("customer_email", 1)])
    for spec in conversations.values():
        keys = list(spec.get("key") or [])
        if keys in (
            [("workspace_id", 1), ("customer_id", 1)],
            [("workspace_id", 1), ("customer_email", 1)],
        ):
            assert spec.get("unique") is not True
    assert not has_key(customers, [("owner_id", 1), ("email", 1)])
    assert has_key(customers, [("workspace_id", 1), ("email", 1)])
    assert has_key(tickets, [("owner_id", 1), ("updated_at", -1)])
    assert has_key(tickets, [("owner_id", 1), ("customer_id", 1)])
    assert has_key(tickets, [("workspace_id", 1), ("updated_at", -1)])
    assert has_key(tickets, [("workspace_id", 1), ("status", 1)])
    assert has_key(tickets, [("workspace_id", 1), ("priority", 1)])
    assert has_key(tickets, [("workspace_id", 1), ("assignee_id", 1)])
    assert has_key(tickets, [("workspace_id", 1), ("customer_id", 1)])
    assert has_key(tickets, [("workspace_id", 1), ("conversation_id", 1)])
    for spec in tickets.values():
        keys = list(spec.get("key") or [])
        if keys == [("workspace_id", 1), ("conversation_id", 1)]:
            assert spec.get("unique") is not True
    assert not has_key(team_members, [("owner_id", 1), ("email", 1)])
    assert has_key(team_members, [("owner_id", 1), ("updated_at", -1)])
    assert has_key(team_members, [("owner_id", 1), ("role", 1)])
    assert has_key(team_members, [("owner_id", 1), ("status", 1)])
    assert has_key(team_members, [("workspace_id", 1), ("updated_at", -1)])
    assert has_key(team_members, [("workspace_id", 1), ("email", 1)])
    assert has_key(team_members, [("workspace_id", 1), ("role", 1)])
    assert has_key(team_members, [("workspace_id", 1), ("status", 1)])
    assert has_key(team_members, [("workspace_id", 1), ("user_id", 1)])
    assert has_key(knowledge, [("owner_id", 1), ("updated_at", -1)])
    assert has_key(knowledge, [("owner_id", 1), ("status", 1)])
    assert has_key(knowledge, [("workspace_id", 1), ("updated_at", -1)])
    assert has_key(knowledge, [("workspace_id", 1), ("status", 1)])

    workspace_email = None
    for spec in customers.values():
        keys = list(spec.get("key") or [])
        if keys == [("workspace_id", 1), ("email", 1)]:
            workspace_email = spec
    assert workspace_email is not None
    assert workspace_email.get("unique") is True

    member_workspace_email = None
    member_workspace_user = None
    for spec in team_members.values():
        keys = list(spec.get("key") or [])
        if keys == [("workspace_id", 1), ("email", 1)]:
            member_workspace_email = spec
        if keys == [("workspace_id", 1), ("user_id", 1)]:
            member_workspace_user = spec
    assert member_workspace_email is not None
    assert member_workspace_email.get("unique") is True
    assert member_workspace_user is not None
    assert member_workspace_user.get("unique") is True
    assert member_workspace_user.get("partialFilterExpression") == {
        "user_id": {"$type": "string"},
    }


@pytest.mark.asyncio
async def test_team_membership_user_id_is_unique_per_workspace(indexed_db) -> None:
    first = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        role="AGENT",
        user_id="user-shared",
        workspace_id=WORKSPACE_ID,
    )
    duplicate = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Ada",
        last_name="Clone",
        email="clone@example.com",
        role="ADMIN",
        user_id="user-shared",
        workspace_id=WORKSPACE_ID,
    )
    await indexed_db.team_members.insert_one(first)
    with pytest.raises(DuplicateKeyError):
        await indexed_db.team_members.insert_one(duplicate)


@pytest.mark.asyncio
async def test_same_user_id_can_belong_to_different_workspaces(indexed_db) -> None:
    first = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        role="OWNER",
        user_id="user-shared",
        member_id="user-shared",
        workspace_id=WORKSPACE_ID,
    )
    second = build_team_member_document(
        owner_id="other-owner",
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        role="AGENT",
        user_id="user-shared",
        workspace_id="workspace-2",
    )
    await indexed_db.team_members.insert_one(first)
    await indexed_db.team_members.insert_one(second)
    assert await indexed_db.team_members.count_documents({"user_id": "user-shared"}) == 2


@pytest.mark.asyncio
async def test_team_members_without_user_id_can_share_a_workspace(indexed_db) -> None:
    first = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Sarah",
        last_name="Perera",
        email="sarah@example.com",
        role="AGENT",
        user_id=None,
        workspace_id=WORKSPACE_ID,
    )
    second = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="John",
        last_name="Silva",
        email="john@example.com",
        role="ADMIN",
        user_id=None,
        workspace_id=WORKSPACE_ID,
    )
    assert "user_id" not in first
    assert "user_id" not in second
    await indexed_db.team_members.insert_one(first)
    await indexed_db.team_members.insert_one(second)
    assert await indexed_db.team_members.count_documents({"workspace_id": WORKSPACE_ID}) == 2


@pytest.mark.asyncio
async def test_same_customer_email_allowed_for_same_owner_in_different_workspaces(
    indexed_db,
) -> None:
    first = build_customer_document(
        owner_id=OWNER_ID,
        workspace_id=WORKSPACE_ID,
        first_name="Elena",
        last_name="Park",
        email="elena@example.com",
    )
    second = build_customer_document(
        owner_id=OWNER_ID,
        workspace_id="workspace-2",
        first_name="Elena",
        last_name="Park",
        email="elena@example.com",
    )
    await indexed_db.customers.insert_one(first)
    await indexed_db.customers.insert_one(second)
    assert await indexed_db.customers.count_documents({"email": "elena@example.com"}) == 2


@pytest.mark.asyncio
async def test_same_team_member_email_allowed_for_same_creator_in_different_workspaces(
    indexed_db,
) -> None:
    first = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Sarah",
        last_name="Perera",
        email="sarah@example.com",
        role="AGENT",
        workspace_id=WORKSPACE_ID,
    )
    second = build_team_member_document(
        owner_id=OWNER_ID,
        first_name="Sarah",
        last_name="Perera",
        email="sarah@example.com",
        role="AGENT",
        workspace_id="workspace-2",
    )
    await indexed_db.team_members.insert_one(first)
    await indexed_db.team_members.insert_one(second)
    assert await indexed_db.team_members.count_documents(
        {"email": "sarah@example.com"},
    ) == 2
