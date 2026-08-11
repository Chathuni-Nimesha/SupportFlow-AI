"""Shared pytest fixtures for SupportFlow AI backend tests."""

import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

# Ensure JWT/settings are deterministic before app modules cache Settings.
os.environ["JWT_SECRET"] = "test-only-jwt-secret-key"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["JWT_EXPIRE_MINUTES"] = "60"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"
os.environ["MONGODB_DATABASE"] = "supportflow_test"


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.config.settings import get_settings
    from app.database import mongodb as mongodb_module
    from main import app

    get_settings.cache_clear()

    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["supportflow_test"]
    await mock_db.users.create_index("email", unique=True)

    mongodb_module._client = mock_client
    mongodb_module._database = mock_db

    async def _noop_connect():
        return mock_db

    async def _noop_close() -> None:
        return None

    async def _noop_indexes() -> None:
        return None

    # Prevent app lifespan from replacing the mock database.
    mongodb_module.connect_mongodb = _noop_connect  # type: ignore[method-assign]
    mongodb_module.close_mongodb = _noop_close  # type: ignore[method-assign]

    import app.database.indexes as indexes_module

    indexes_module.ensure_indexes = _noop_indexes  # type: ignore[method-assign]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    mongodb_module._client = None
    mongodb_module._database = None
    get_settings.cache_clear()


@pytest.fixture
def sample_register_payload() -> dict:
    return {
        "first_name": "Maya",
        "last_name": "Chen",
        "company_name": "Acme Support",
        "email": "maya@acme.example",
        "password": "securepass123",
    }
