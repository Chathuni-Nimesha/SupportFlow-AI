"""Phase 1B workspace backfill tests. Runtime isolation uses workspace_id."""

from collections.abc import AsyncIterator
from copy import deepcopy

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.database import mongodb as mongodb_module
from app.migrations.workspace_backfill import (
    format_backfill_report,
    personal_workspace_name,
    run_workspace_backfill,
)
from app.models.conversation import build_conversation_document
from app.models.customer import build_customer_document
from app.models.knowledge import build_knowledge_document
from app.models.message import build_message_document
from app.models.team_member import build_team_member_document
from app.models.ticket import build_ticket_document
from app.models.user import USERS_COLLECTION, build_user_document
from app.models.workspace import WORKSPACES_COLLECTION, build_workspace_document
from scripts.backfill_workspaces import parse_args


USER_A = "user-a"
USER_B = "user-b"
EXISTING_WORKSPACE = "workspace-preexisting"
PRESERVED_WORKSPACE = "workspace-keep-me"


@pytest.fixture
async def db() -> AsyncIterator:
    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["supportflow_backfill_test"]
    await mock_db[WORKSPACES_COLLECTION].create_index("owner_user_id", unique=True)
    previous_client = mongodb_module._client
    previous_db = mongodb_module._database
    mongodb_module._client = mock_client
    mongodb_module._database = mock_db
    try:
        yield mock_db
    finally:
        mongodb_module._client = previous_client
        mongodb_module._database = previous_db


def _user(*, user_id: str, email: str, company: str, first: str = "Maya") -> dict:
    document = build_user_document(
        first_name=first,
        last_name="Chen",
        company_name=company,
        email=email,
        password_hash="hashed",
    )
    document["_id"] = user_id
    return document


async def _seed_owner_graph(
    db,
    *,
    user_id: str,
    email: str,
    company: str,
    first: str = "Maya",
    extra_customer_workspace_id: str | None = None,
) -> dict:
    user = _user(user_id=user_id, email=email, company=company, first=first)
    await db[USERS_COLLECTION].insert_one(user)

    owner_member = build_team_member_document(
        owner_id=user_id,
        user_id=user_id,
        first_name=first,
        last_name="Chen",
        email=email,
        role="OWNER",
        status="ACTIVE",
        member_id=user_id,
    )
    agent = build_team_member_document(
        owner_id=user_id,
        first_name="Alex",
        last_name="Agent",
        email=f"agent-{email}",
        role="AGENT",
        status="ACTIVE",
        member_id=f"{user_id}-agent",
    )
    await db.team_members.insert_many([owner_member, agent])

    customer = build_customer_document(
        owner_id=user_id,
        first_name="Ada",
        last_name="Lovelace",
        email=f"ada-{email}",
        workspace_id=extra_customer_workspace_id,
    )
    await db.customers.insert_one(customer)

    conversation = build_conversation_document(
        owner_id=user_id,
        customer_name="Ada Lovelace",
        customer_email=f"ada-{email}",
        subject="Help",
        channel="Chat",
        assigned_agent_id=agent["_id"],
    )
    await db.conversations.insert_one(conversation)

    message = build_message_document(
        conversation_id=str(conversation["_id"]),
        owner_id=user_id,
        sender_type="customer",
        content="Hello",
    )
    await db.messages.insert_one(message)

    ticket = build_ticket_document(
        owner_id=user_id,
        customer_id=str(customer["_id"]),
        title="Outage",
        description="Site down",
        assignee_id=agent["_id"],
    )
    await db.tickets.insert_one(ticket)

    knowledge = build_knowledge_document(
        owner_id=user_id,
        title="Refunds",
        content="Refunds take 5 days.",
    )
    await db.knowledge_documents.insert_one(knowledge)

    return {
        "user": user,
        "owner_member": owner_member,
        "agent": agent,
        "customer": customer,
        "conversation": conversation,
        "message": message,
        "ticket": ticket,
        "knowledge": knowledge,
    }


async def _dump(db) -> dict[str, list[dict]]:
    names = [
        "users",
        "workspaces",
        "conversations",
        "messages",
        "customers",
        "tickets",
        "team_members",
        "knowledge_documents",
    ]
    dumped: dict[str, list[dict]] = {}
    for name in names:
        docs = await db[name].find({}).to_list(length=1000)
        dumped[name] = sorted(deepcopy(docs), key=lambda item: str(item["_id"]))
    return dumped


def test_personal_workspace_name_prefers_company() -> None:
    assert personal_workspace_name({"company_name": "Acme Support"}) == "Acme Support"
    assert (
        personal_workspace_name(
            {"company_name": "  ", "first_name": "Maya", "last_name": "Chen"},
        )
        == "Maya Chen's Workspace"
    )


def test_parse_args_dry_run() -> None:
    assert parse_args(["--dry-run"]).dry_run is True
    assert parse_args([]).dry_run is False


@pytest.mark.asyncio
async def test_single_existing_user_backfill(db) -> None:
    seeded = await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )

    report = await run_workspace_backfill(db, dry_run=False)

    assert len(report.users) == 1
    stats = report.users[0]
    assert stats.workspace_created == 1
    assert stats.workspace_reused == 0
    assert stats.workspace_id is not None
    assert stats.workspace_id != USER_A
    assert stats.workspace_name == "Acme Support"
    assert stats.conversations == 1
    assert stats.messages == 1
    assert stats.customers == 1
    assert stats.tickets == 1
    assert stats.team_members == 2
    assert stats.knowledge_documents == 1

    workspace = await db.workspaces.find_one({"owner_user_id": USER_A})
    assert workspace is not None
    assert workspace["_id"] == stats.workspace_id
    assert workspace["_id"] != USER_A

    owner = await db.team_members.find_one({"_id": USER_A})
    assert owner["workspace_id"] == stats.workspace_id
    assert owner["owner_id"] == seeded["owner_member"]["owner_id"]
    assert owner["user_id"] == USER_A
    assert owner["role"] == "OWNER"
    assert owner["status"] == "ACTIVE"

    ticket = await db.tickets.find_one({"_id": seeded["ticket"]["_id"]})
    assert ticket["owner_id"] == USER_A
    assert ticket["workspace_id"] == stats.workspace_id
    assert ticket["assignee_id"] == seeded["agent"]["_id"]


@pytest.mark.asyncio
async def test_two_users_get_isolated_workspaces(db) -> None:
    await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    await _seed_owner_graph(
        db,
        user_id=USER_B,
        email="other@acme.example",
        company="Other Co",
        first="Omar",
    )

    report = await run_workspace_backfill(db, dry_run=False)
    assert len(report.users) == 2
    ids = {row.user_id: row.workspace_id for row in report.users}
    assert ids[USER_A] != ids[USER_B]
    assert ids[USER_A] != USER_A
    assert ids[USER_B] != USER_B

    a_customers = await db.customers.find({"owner_id": USER_A}).to_list(length=10)
    b_customers = await db.customers.find({"owner_id": USER_B}).to_list(length=10)
    assert {doc["workspace_id"] for doc in a_customers} == {ids[USER_A]}
    assert {doc["workspace_id"] for doc in b_customers} == {ids[USER_B]}

    cross = await db.conversations.count_documents(
        {"owner_id": USER_A, "workspace_id": ids[USER_B]},
    )
    assert cross == 0
    assert await db.workspaces.count_documents({}) == 2


@pytest.mark.asyncio
async def test_existing_workspace_is_reused(db) -> None:
    await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    existing = build_workspace_document(
        name="Already There",
        owner_user_id=USER_A,
        workspace_id=EXISTING_WORKSPACE,
    )
    await db.workspaces.insert_one(existing)

    report = await run_workspace_backfill(db, dry_run=False)
    assert report.users[0].workspace_created == 0
    assert report.users[0].workspace_reused == 1
    assert report.users[0].workspace_id == EXISTING_WORKSPACE
    assert await db.workspaces.count_documents({"owner_user_id": USER_A}) == 1

    customer = await db.customers.find_one({"owner_id": USER_A})
    assert customer["workspace_id"] == EXISTING_WORKSPACE


@pytest.mark.asyncio
async def test_second_run_is_idempotent(db) -> None:
    await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    first = await run_workspace_backfill(db, dry_run=False)
    snapshot = await _dump(db)
    second = await run_workspace_backfill(db, dry_run=False)

    assert second.users[0].workspace_created == 0
    assert second.users[0].workspace_reused == 1
    assert second.users[0].workspace_id == first.users[0].workspace_id
    assert second.totals["workspace"] == 0
    assert second.totals["conversations"] == 0
    assert second.totals["messages"] == 0
    assert second.totals["customers"] == 0
    assert second.totals["tickets"] == 0
    assert second.totals["team_members"] == 0
    assert second.totals["knowledge_documents"] == 0
    assert await _dump(db) == snapshot
    assert await db.workspaces.count_documents({}) == 1


@pytest.mark.asyncio
async def test_existing_workspace_id_is_preserved(db) -> None:
    seeded = await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
        extra_customer_workspace_id=PRESERVED_WORKSPACE,
    )
    extra = build_customer_document(
        owner_id=USER_A,
        first_name="Grace",
        last_name="Hopper",
        email="grace@acme.example",
    )
    await db.customers.insert_one(extra)

    report = await run_workspace_backfill(db, dry_run=False)
    workspace_id = report.users[0].workspace_id
    assert report.users[0].customers == 1

    preserved = await db.customers.find_one({"_id": seeded["customer"]["_id"]})
    updated = await db.customers.find_one({"_id": extra["_id"]})
    assert preserved["workspace_id"] == PRESERVED_WORKSPACE
    assert preserved["owner_id"] == USER_A
    assert updated["workspace_id"] == workspace_id
    assert updated["owner_id"] == USER_A


@pytest.mark.asyncio
async def test_owner_team_member_id_is_preserved(db) -> None:
    await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    await run_workspace_backfill(db, dry_run=False)
    owner = await db.team_members.find_one({"role": "OWNER", "owner_id": USER_A})
    assert owner["_id"] == USER_A
    assert owner["user_id"] == USER_A
    assert owner["owner_id"] == USER_A
    assert owner["role"] == "OWNER"
    assert owner["status"] == "ACTIVE"
    assert "workspace_id" in owner
    assert await db.team_members.count_documents({"role": "OWNER", "owner_id": USER_A}) == 1


@pytest.mark.asyncio
async def test_assignee_ids_are_preserved(db) -> None:
    seeded = await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    await run_workspace_backfill(db, dry_run=False)

    ticket = await db.tickets.find_one({"_id": seeded["ticket"]["_id"]})
    conversation = await db.conversations.find_one(
        {"_id": seeded["conversation"]["_id"]},
    )
    assert ticket["assignee_id"] == seeded["agent"]["_id"]
    assert conversation["assigned_agent_id"] == seeded["agent"]["_id"]
    assert ticket["owner_id"] == USER_A
    assert conversation["owner_id"] == USER_A


@pytest.mark.asyncio
async def test_dry_run_performs_zero_writes(db) -> None:
    await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    before = await _dump(db)
    report = await run_workspace_backfill(db, dry_run=True)
    after = await _dump(db)

    assert before == after
    assert await db.workspaces.count_documents({}) == 0
    assert report.dry_run is True
    assert report.users[0].workspace_created == 1
    assert report.users[0].workspace_id is None
    assert report.users[0].conversations == 1
    assert report.users[0].team_members == 2
    customer = await db.customers.find_one({"owner_id": USER_A})
    assert "workspace_id" not in customer


@pytest.mark.asyncio
async def test_no_cross_user_workspace_assignment(db) -> None:
    await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    await _seed_owner_graph(
        db,
        user_id=USER_B,
        email="other@acme.example",
        company="Other Co",
        first="Omar",
    )
    await db.workspaces.insert_one(
        build_workspace_document(
            name="Other Co",
            owner_user_id=USER_B,
            workspace_id="workspace-b-only",
        ),
    )

    report = await run_workspace_backfill(db, dry_run=False)
    workspace_a = next(row.workspace_id for row in report.users if row.user_id == USER_A)
    workspace_b = next(row.workspace_id for row in report.users if row.user_id == USER_B)
    assert workspace_b == "workspace-b-only"
    assert workspace_a != workspace_b

    for collection in (
        "conversations",
        "messages",
        "customers",
        "tickets",
        "team_members",
        "knowledge_documents",
    ):
        leaked = await db[collection].count_documents(
            {"owner_id": USER_A, "workspace_id": workspace_b},
        )
        assert leaked == 0
        leaked_b = await db[collection].count_documents(
            {"owner_id": USER_B, "workspace_id": workspace_a},
        )
        assert leaked_b == 0


@pytest.mark.asyncio
async def test_owner_id_never_removed_or_changed(db) -> None:
    seeded = await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    await run_workspace_backfill(db, dry_run=False)

    for name, original in (
        ("conversations", seeded["conversation"]),
        ("messages", seeded["message"]),
        ("customers", seeded["customer"]),
        ("tickets", seeded["ticket"]),
        ("team_members", seeded["owner_member"]),
        ("knowledge_documents", seeded["knowledge"]),
    ):
        document = await db[name].find_one({"_id": original["_id"]})
        assert document["owner_id"] == USER_A
        assert document["owner_id"] == original["owner_id"]


@pytest.mark.asyncio
async def test_format_report_includes_per_user_counts(db) -> None:
    await _seed_owner_graph(
        db,
        user_id=USER_A,
        email="maya@acme.example",
        company="Acme Support",
    )
    report = await run_workspace_backfill(db, dry_run=True)
    output = format_backfill_report(report)
    assert "DRY RUN (zero writes)" in output
    assert "workspace:" in output
    assert "conversations:" in output
    assert "messages:" in output
    assert "customers:" in output
    assert "tickets:" in output
    assert "team_members:" in output
    assert "knowledge_documents:" in output
    assert "maya@acme.example" in output
