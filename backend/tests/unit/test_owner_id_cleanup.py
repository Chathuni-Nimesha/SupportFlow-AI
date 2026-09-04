"""Phase 1I owner_id index cleanup tests."""

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.database import mongodb as mongodb_module
from app.database.indexes import ensure_indexes
from app.migrations.owner_id_cleanup import (
    format_owner_id_cleanup_report,
    run_owner_id_cleanup,
)
from app.models.customer import CUSTOMERS_COLLECTION
from app.models.team_member import TEAM_MEMBERS_COLLECTION


@pytest.fixture
async def cleanup_db():
    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["supportflow_owner_id_cleanup_test"]
    previous_client = mongodb_module._client
    previous_db = mongodb_module._database
    mongodb_module._client = mock_client
    mongodb_module._database = mock_db
    try:
        yield mock_db
    finally:
        mongodb_module._client = previous_client
        mongodb_module._database = previous_db


def _has_unique_owner_email(info: dict) -> bool:
    for spec in info.values():
        keys = list(spec.get("key") or [])
        if keys == [("owner_id", 1), ("email", 1)] and spec.get("unique"):
            return True
    return False


@pytest.mark.asyncio
async def test_owner_id_cleanup_dry_run_does_not_drop_indexes(cleanup_db) -> None:
    await cleanup_db[CUSTOMERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    await cleanup_db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )

    report = await run_owner_id_cleanup(cleanup_db, dry_run=True)
    assert report.dry_run is True
    assert report.scanned == 2
    assert report.changed == 2
    assert report.skipped == 0
    assert "would drop" in format_owner_id_cleanup_report(report)
    assert _has_unique_owner_email(await cleanup_db.customers.index_information())
    assert _has_unique_owner_email(await cleanup_db.team_members.index_information())


@pytest.mark.asyncio
async def test_owner_id_cleanup_drops_unique_indexes_and_is_idempotent(
    cleanup_db,
) -> None:
    await cleanup_db[CUSTOMERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    await cleanup_db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )

    first = await run_owner_id_cleanup(cleanup_db, dry_run=False)
    assert first.dry_run is False
    assert first.changed == 2
    assert first.skipped == 0
    assert not _has_unique_owner_email(await cleanup_db.customers.index_information())
    assert not _has_unique_owner_email(
        await cleanup_db.team_members.index_information(),
    )

    second = await run_owner_id_cleanup(cleanup_db, dry_run=False)
    assert second.changed == 0
    assert second.skipped == 2


@pytest.mark.asyncio
async def test_ensure_indexes_does_not_recreate_unique_owner_email(
    cleanup_db,
) -> None:
    mongodb_module._database = cleanup_db
    await ensure_indexes()
    assert not _has_unique_owner_email(await cleanup_db.customers.index_information())
    assert not _has_unique_owner_email(
        await cleanup_db.team_members.index_information(),
    )
    customers = await cleanup_db.customers.index_information()
    team_members = await cleanup_db.team_members.index_information()
    assert any(
        list(spec.get("key") or []) == [("workspace_id", 1), ("email", 1)]
        and spec.get("unique")
        for spec in customers.values()
    )
    assert any(
        list(spec.get("key") or []) == [("workspace_id", 1), ("email", 1)]
        and spec.get("unique")
        for spec in team_members.values()
    )
