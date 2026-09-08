"""Tests for the local portfolio demo seed."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.config.settings import get_settings
from app.database import chroma as chroma_module
from app.database import mongodb as mongodb_module
from app.demo.catalog import (
    CONVERSATIONS,
    CUSTOMERS,
    KNOWLEDGE_DOCUMENTS,
    TEAM_MEMBERS,
    TICKETS,
)
from app.demo.constants import DEFAULT_OWNER_EMAIL, DEMO_SEED_TAG
from app.demo.seed import (
    PRODUCTION_SEED_BLOCKED,
    REMOTE_MONGO_BLOCKED,
    format_seed_report,
    run_portfolio_seed,
)
from app.models.customer import CUSTOMERS_COLLECTION
from app.models.knowledge import KNOWLEDGE_DOCUMENTS_COLLECTION
from app.models.team_member import TEAM_MEMBERS_COLLECTION
from app.models.ticket import TICKETS_COLLECTION
from app.models.user import USERS_COLLECTION
from app.models.workspace import WORKSPACES_COLLECTION
from scripts.seed_demo_data import parse_args


@pytest.fixture
async def seed_db(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017")
    monkeypatch.setenv("VECTOR_STORE", "chroma")
    monkeypatch.setenv("CHROMA_MODE", "ephemeral")
    monkeypatch.setenv("CHROMA_EMBEDDING_MODEL", "hash")
    monkeypatch.setenv("CHROMA_COLLECTION", "supportflow_demo_seed_test")
    monkeypatch.delenv("VERCEL", raising=False)
    get_settings.cache_clear()
    chroma_module.reset_chroma_client()

    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["supportflow_demo_seed_test"]
    await mock_db[USERS_COLLECTION].create_index("email", unique=True)
    await mock_db[WORKSPACES_COLLECTION].create_index("owner_user_id", unique=True)
    await mock_db[CUSTOMERS_COLLECTION].create_index(
        [("workspace_id", 1), ("email", 1)],
        unique=True,
    )
    await mock_db[TEAM_MEMBERS_COLLECTION].create_index(
        [("workspace_id", 1), ("email", 1)],
        unique=True,
    )
    await mock_db[TEAM_MEMBERS_COLLECTION].create_index(
        [("workspace_id", 1), ("user_id", 1)],
        unique=True,
        partialFilterExpression={"user_id": {"$type": "string"}},
    )

    previous_client = mongodb_module._client
    previous_db = mongodb_module._database
    mongodb_module._client = mock_client
    mongodb_module._database = mock_db

    async def _noop_indexes() -> None:
        return None

    import app.database.indexes as indexes_module

    previous_ensure = indexes_module.ensure_indexes
    indexes_module.ensure_indexes = _noop_indexes  # type: ignore[method-assign]

    try:
        yield mock_db
    finally:
        indexes_module.ensure_indexes = previous_ensure  # type: ignore[method-assign]
        mongodb_module._client = previous_client
        mongodb_module._database = previous_db
        chroma_module.reset_chroma_client()
        get_settings.cache_clear()


def test_parse_args_defaults() -> None:
    args = parse_args([])
    assert args.dry_run is False
    assert args.owner_email == DEFAULT_OWNER_EMAIL
    assert args.allow_non_localhost is False
    assert args.create_owner_if_missing is False


def test_parse_args_dry_run() -> None:
    args = parse_args(["--dry-run", "--skip-rag-check", "--create-owner-if-missing"])
    assert args.dry_run is True
    assert args.skip_rag_check is True
    assert args.create_owner_if_missing is True


@pytest.mark.asyncio
async def test_seed_blocked_in_production(
    seed_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="production"):
        await run_portfolio_seed(skip_rag_check=True, create_owner_if_missing=True)


@pytest.mark.asyncio
async def test_seed_blocked_for_remote_mongo_without_flag(
    seed_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "MONGODB_URI",
        "mongodb+srv://user:pass@cluster0.example.mongodb.net",
    )
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="localhost"):
        await run_portfolio_seed(skip_rag_check=True, create_owner_if_missing=True)


@pytest.mark.asyncio
async def test_seed_requires_existing_owner_by_default(seed_db) -> None:
    with pytest.raises(RuntimeError, match="Owner account not found"):
        await run_portfolio_seed(skip_rag_check=True)


@pytest.mark.asyncio
async def test_seed_creates_expected_graph_and_is_idempotent(seed_db) -> None:
    first = await run_portfolio_seed(
        skip_rag_check=False,
        create_owner_if_missing=True,
    )
    assert first.users.created == 1
    assert first.team_members.created == len(TEAM_MEMBERS)
    assert first.customers.created == len(CUSTOMERS)
    assert first.conversations.created == len(CONVERSATIONS)
    assert first.tickets.created == len(TICKETS)
    assert first.knowledge_documents.created == len(KNOWLEDGE_DOCUMENTS)
    assert first.knowledge_published == len(KNOWLEDGE_DOCUMENTS)
    assert first.messages.created >= len(CONVERSATIONS)
    assert first.workspace_id
    assert first.workspace_name
    assert first.knowledge_indexed == len(KNOWLEDGE_DOCUMENTS)
    assert first.rag_verified is True
    assert first.kpi_customers == len(CUSTOMERS)
    assert first.kpi_conversations == len(CONVERSATIONS)

    db = seed_db
    assert await db[USERS_COLLECTION].count_documents({}) == 1
    assert await db[TEAM_MEMBERS_COLLECTION].count_documents(
        {"workspace_id": first.workspace_id},
    ) == 1 + len(TEAM_MEMBERS)
    assert await db[CUSTOMERS_COLLECTION].count_documents(
        {"workspace_id": first.workspace_id},
    ) == len(CUSTOMERS)
    assert await db[TICKETS_COLLECTION].count_documents(
        {"workspace_id": first.workspace_id},
    ) == len(TICKETS)
    published = await db[KNOWLEDGE_DOCUMENTS_COLLECTION].count_documents(
        {
            "workspace_id": first.workspace_id,
            "status": "Published",
            "tags": DEMO_SEED_TAG,
        },
    )
    assert published == len(KNOWLEDGE_DOCUMENTS)

    second = await run_portfolio_seed(skip_rag_check=True)
    assert second.users.created == 0
    assert second.users.skipped == 1
    assert second.team_members.created == 0
    assert second.team_members.skipped == len(TEAM_MEMBERS)
    assert second.customers.created == 0
    assert second.customers.skipped == len(CUSTOMERS)
    assert second.conversations.created == 0
    assert second.conversations.skipped == len(CONVERSATIONS)
    assert second.tickets.created == 0
    assert second.tickets.skipped == len(TICKETS)
    assert second.knowledge_documents.created == 0
    assert second.knowledge_documents.skipped == len(KNOWLEDGE_DOCUMENTS)

    text = format_seed_report(second)
    assert "skipped:" in text
    assert "Demo seed completed successfully." in text


@pytest.mark.asyncio
async def test_dry_run_does_not_write(seed_db) -> None:
    report = await run_portfolio_seed(
        dry_run=True,
        skip_rag_check=True,
        create_owner_if_missing=True,
    )
    assert report.dry_run is True
    assert report.users.created == 1
    assert report.customers.created == len(CUSTOMERS)
    assert await seed_db[USERS_COLLECTION].count_documents({}) == 0
    assert await seed_db[CUSTOMERS_COLLECTION].count_documents({}) == 0


@pytest.mark.asyncio
async def test_allow_non_localhost_flag(
    seed_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "MONGODB_URI",
        "mongodb+srv://user:pass@cluster0.example.mongodb.net",
    )
    get_settings.cache_clear()
    with pytest.raises(RuntimeError) as excinfo:
        await run_portfolio_seed(
            skip_rag_check=True,
            create_owner_if_missing=True,
        )
    assert str(excinfo.value) == REMOTE_MONGO_BLOCKED

    report = await run_portfolio_seed(
        allow_non_localhost=True,
        skip_rag_check=True,
        create_owner_if_missing=True,
    )
    assert report.users.created == 1


@pytest.mark.asyncio
async def test_production_message_constant() -> None:
    assert "production" in PRODUCTION_SEED_BLOCKED.lower()
