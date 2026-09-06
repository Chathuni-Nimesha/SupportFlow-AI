"""Authentication API tests."""

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
from app.database import mongodb as mongodb_module


@pytest.mark.asyncio
async def test_register_rejects_password_over_bcrypt_limit(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    payload = {**sample_register_payload, "password": "a" * 73}
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "mongodb" not in response.text.lower()


@pytest.mark.asyncio
async def test_successful_registration(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=sample_register_payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == sample_register_payload["email"]
    assert data["first_name"] == "Maya"
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data
    assert "id" in data
    assert data["default_workspace_id"]
    assert data["default_workspace_id"] != data["id"]
    assert data["workspaces"][0]["role"] == "OWNER"


@pytest.mark.asyncio
async def test_duplicate_registration(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    first = await client.post("/api/v1/auth/register", json=sample_register_payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/register", json=sample_register_payload)
    assert second.status_code == 409
    assert "already exists" in second.json()["detail"].lower()


@pytest.mark.asyncio
async def test_successful_login(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    await client.post("/api/v1/auth/register", json=sample_register_payload)

    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": sample_register_payload["email"],
            "password": sample_register_payload["password"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == sample_register_payload["email"]
    assert "password_hash" not in data["user"]


@pytest.mark.asyncio
async def test_invalid_password(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    await client.post("/api/v1/auth/register", json=sample_register_payload)

    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": sample_register_payload["email"],
            "password": "wrong-password",
        },
    )
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_current_user(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    await client.post("/api/v1/auth/register", json=sample_register_payload)
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": sample_register_payload["email"],
            "password": sample_register_payload["password"],
        },
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == sample_register_payload["email"]
    body = response.json()
    assert body["default_workspace_id"]
    assert body["default_workspace_id"] != body["id"]
    assert body["workspaces"][0]["name"] == "Acme Support"


@pytest.mark.asyncio
async def test_invalid_jwt(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_inactive_user(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    register = await client.post(
        "/api/v1/auth/register",
        json=sample_register_payload,
    )
    user_id = register.json()["id"]

    await mongodb_module._database.users.update_one(
        {"_id": user_id},
        {"$set": {"is_active": False}},
    )

    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": sample_register_payload["email"],
            "password": sample_register_payload["password"],
        },
    )
    assert login.status_code == 403
    assert "inactive" in login.json()["detail"].lower()

    token = create_access_token(subject=user_id)
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 403
