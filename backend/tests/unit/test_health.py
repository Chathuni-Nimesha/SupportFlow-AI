"""Application health endpoint tests."""

import pytest
from httpx import AsyncClient

from app.database import mongodb as mongodb_module


@pytest.mark.asyncio
async def test_health_reports_connected_database(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert "mongodb_uri" not in body
    assert "password" not in str(body).lower()
    assert "secret" not in str(body).lower()


@pytest.mark.asyncio
async def test_health_reports_disconnected_database(client: AsyncClient) -> None:
    original_client = mongodb_module._client
    mongodb_module._client = None
    try:
        response = await client.get("/health")
        assert response.status_code == 503
        body = response.json()
        assert body["status"] == "degraded"
        assert body["database"] == "disconnected"
        assert "mongodb_uri" not in body
    finally:
        mongodb_module._client = original_client
