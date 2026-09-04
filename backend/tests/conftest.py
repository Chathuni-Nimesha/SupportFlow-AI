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
os.environ["CHROMA_MODE"] = "ephemeral"
os.environ["CHROMA_EMBEDDING_MODEL"] = "hash"
os.environ["CHROMA_COLLECTION"] = "supportflow_knowledge_test"


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.config.settings import get_settings
    from app.database import chroma as chroma_module
    from app.database import mongodb as mongodb_module
    from main import app

    get_settings.cache_clear()
    chroma_module.reset_chroma_client()
    from app.core.rate_limit import reset_auth_rate_limiter

    reset_auth_rate_limiter()

    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["supportflow_test"]
    await mock_db.users.create_index("email", unique=True)
    await mock_db.customers.create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    await mock_db.customers.create_index(
        [("workspace_id", 1), ("email", 1)],
        unique=True,
    )
    await mock_db.team_members.create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    await mock_db.team_members.create_index(
        [("workspace_id", 1), ("email", 1)],
        unique=True,
    )
    await mock_db.team_members.create_index(
        [("workspace_id", 1), ("user_id", 1)],
        unique=True,
        partialFilterExpression={"user_id": {"$type": "string"}},
    )
    await mock_db.workspaces.create_index("owner_user_id", unique=True)

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
    chroma_module.reset_chroma_client()
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


@pytest.fixture
async def auth_headers(
    client: AsyncClient,
    sample_register_payload: dict,
) -> dict[str, str]:
    """Register + login and return Authorization headers for protected routes."""
    await client.post("/api/v1/auth/register", json=sample_register_payload)
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": sample_register_payload["email"],
            "password": sample_register_payload["password"],
        },
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
