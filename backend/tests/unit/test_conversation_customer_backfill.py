"""Phase 2B conversation.customer_id backfill tests."""

from collections.abc import AsyncIterator

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.database import mongodb as mongodb_module
from app.migrations.conversation_customer_backfill import (
    format_conversation_customer_backfill_report,
    run_conversation_customer_backfill,
)
from app.models.conversation import build_conversation_document
from app.models.customer import build_customer_document
from scripts.backfill_conversation_customers import parse_args


OWNER_A = "user-a"
OWNER_B = "user-b"
WORKSPACE_A = "workspace-a"
WORKSPACE_B = "workspace-b"


@pytest.fixture
async def db() -> AsyncIterator:
    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["supportflow_conversation_customer_backfill_test"]
    previous_client = mongodb_module._client
    previous_db = mongodb_module._database
    mongodb_module._client = mock_client
    mongodb_module._database = mock_db
    try:
        yield mock_db
    finally:
        mongodb_module._client = previous_client
        mongodb_module._database = previous_db


async def _insert_customer(
    db,
    *,
    workspace_id: str,
    email: str,
    owner_id: str = OWNER_A,
    customer_id: str | None = None,
) -> dict:
    document = build_customer_document(
        owner_id=owner_id,
        first_name="Elena",
        last_name="Park",
        email=email,
        workspace_id=workspace_id,
    )
    if customer_id:
        document["_id"] = customer_id
    await db.customers.insert_one(document)
    return document


async def _insert_conversation(
    db,
    *,
    workspace_id: str,
    email: str,
    owner_id: str = OWNER_A,
    customer_id: str | None = None,
    subject: str = "Refund",
) -> dict:
    document = build_conversation_document(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customer_id=customer_id,
        customer_name="Elena Park",
        customer_email=email,
        subject=subject,
        channel="Email",
    )
    await db.conversations.insert_one(document)
    return document


@pytest.mark.asyncio
async def test_backfill_links_exact_workspace_email_matches(db) -> None:
    customer = await _insert_customer(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
    )
    conversation = await _insert_conversation(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
        owner_id=OWNER_A,
    )

    report = await run_conversation_customer_backfill(db, dry_run=False)
    assert report.linked == 1
    assert conversation["_id"] in report.linked_ids

    stored = await db.conversations.find_one({"_id": conversation["_id"]})
    assert stored["customer_id"] == customer["_id"]
    assert stored["owner_id"] == OWNER_A
    assert stored["workspace_id"] == WORKSPACE_A
    assert stored["customer_email"] == "elena@acme.example"
    assert stored["customer_name"] == "Elena Park"


@pytest.mark.asyncio
async def test_backfill_skips_conversations_with_no_matching_customer(db) -> None:
    conversation = await _insert_conversation(
        db,
        workspace_id=WORKSPACE_A,
        email="missing@acme.example",
    )

    report = await run_conversation_customer_backfill(db, dry_run=False)
    assert report.linked == 0
    assert report.skipped_no_match == 1

    stored = await db.conversations.find_one({"_id": conversation["_id"]})
    assert "customer_id" not in stored
    assert stored["owner_id"] == OWNER_A
    assert stored["workspace_id"] == WORKSPACE_A


@pytest.mark.asyncio
async def test_backfill_skips_ambiguous_email_matches(db) -> None:
    first = await _insert_customer(
        db,
        workspace_id=WORKSPACE_A,
        email="dup@acme.example",
        customer_id="cust-1",
    )
    second = await _insert_customer(
        db,
        workspace_id=WORKSPACE_A,
        email="dup@acme.example",
        customer_id="cust-2",
        owner_id=OWNER_B,
    )
    assert first["email"] == second["email"]
    conversation = await _insert_conversation(
        db,
        workspace_id=WORKSPACE_A,
        email="dup@acme.example",
    )

    report = await run_conversation_customer_backfill(db, dry_run=False)
    assert report.linked == 0
    assert report.skipped_ambiguous == 1
    stored = await db.conversations.find_one({"_id": conversation["_id"]})
    assert "customer_id" not in stored


@pytest.mark.asyncio
async def test_backfill_does_not_link_same_email_in_another_workspace(db) -> None:
    await _insert_customer(
        db,
        workspace_id=WORKSPACE_B,
        email="elena@acme.example",
        owner_id=OWNER_B,
        customer_id="foreign-cust",
    )
    conversation = await _insert_conversation(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
        owner_id=OWNER_A,
    )

    report = await run_conversation_customer_backfill(db, dry_run=False)
    assert report.linked == 0
    assert report.skipped_no_match == 1
    stored = await db.conversations.find_one({"_id": conversation["_id"]})
    assert "customer_id" not in stored
    assert stored["workspace_id"] == WORKSPACE_A
    assert stored["owner_id"] == OWNER_A


@pytest.mark.asyncio
async def test_backfill_is_idempotent_and_preserves_identity_fields(db) -> None:
    customer = await _insert_customer(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
    )
    conversation = await _insert_conversation(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
        owner_id=OWNER_A,
    )
    original_email = conversation["customer_email"]
    original_name = conversation["customer_name"]

    first = await run_conversation_customer_backfill(db, dry_run=False)
    assert first.linked == 1
    second = await run_conversation_customer_backfill(db, dry_run=False)
    assert second.linked == 0
    assert second.skipped_already_linked == 1

    stored = await db.conversations.find_one({"_id": conversation["_id"]})
    assert stored["customer_id"] == customer["_id"]
    assert stored["owner_id"] == OWNER_A
    assert stored["workspace_id"] == WORKSPACE_A
    assert stored["customer_email"] == original_email
    assert stored["customer_name"] == original_name


@pytest.mark.asyncio
async def test_backfill_dry_run_performs_zero_writes(db) -> None:
    await _insert_customer(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
    )
    conversation = await _insert_conversation(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
    )

    report = await run_conversation_customer_backfill(db, dry_run=True)
    assert report.dry_run is True
    assert report.linked == 1
    assert "DRY RUN" in format_conversation_customer_backfill_report(report)

    stored = await db.conversations.find_one({"_id": conversation["_id"]})
    assert "customer_id" not in stored
    assert stored["owner_id"] == conversation["owner_id"]
    assert stored["workspace_id"] == conversation["workspace_id"]


@pytest.mark.asyncio
async def test_backfill_never_changes_owner_id_or_workspace_id(db) -> None:
    customer = await _insert_customer(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
        owner_id=OWNER_B,
    )
    conversation = await _insert_conversation(
        db,
        workspace_id=WORKSPACE_A,
        email="elena@acme.example",
        owner_id=OWNER_A,
    )
    assert conversation["owner_id"] != customer["owner_id"]

    await run_conversation_customer_backfill(db, dry_run=False)
    stored = await db.conversations.find_one({"_id": conversation["_id"]})
    assert stored["customer_id"] == customer["_id"]
    assert stored["owner_id"] == OWNER_A
    assert stored["workspace_id"] == WORKSPACE_A
    assert stored["owner_id"] != customer["owner_id"]


def test_backfill_cli_parses_dry_run() -> None:
    assert parse_args(["--dry-run"]).dry_run is True
    assert parse_args([]).dry_run is False
