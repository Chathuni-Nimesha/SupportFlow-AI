"""Server-authoritative workspace switching tests."""

import pytest
from httpx import AsyncClient

from app.core.security import decode_access_token
from app.database import mongodb as mongodb_module
from app.models.team_member import build_team_member_document
from app.schemas.auth import UserResponse
from app.services.workspace_service import resolve_current_workspace


async def _register(client: AsyncClient, payload: dict) -> dict:
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def _login(client: AsyncClient, payload: dict) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _other_payload(sample_register_payload: dict) -> dict:
    return {
        **sample_register_payload,
        "email": "other@acme.example",
        "first_name": "Omar",
        "company_name": "Other Co",
    }


async def _add_active_membership(
    *,
    owner_id: str,
    user: dict,
    workspace_id: str,
    role: str,
    status: str = "ACTIVE",
) -> None:
    member = build_team_member_document(
        owner_id=owner_id,
        user_id=user["id"],
        first_name=user["first_name"],
        last_name=user["last_name"],
        email=user["email"],
        role=role,
        status=status,
        workspace_id=workspace_id,
    )
    await mongodb_module._database.team_members.insert_one(member)


@pytest.mark.asyncio
async def test_user_can_select_workspace_with_active_membership(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user = await _register(client, sample_register_payload)
    other = await _register(client, _other_payload(sample_register_payload))
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
        role="AGENT",
    )
    token = (await _login(client, sample_register_payload))["access_token"]
    headers = _headers(token)

    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    body = selected.json()
    assert body["id"] == other["default_workspace_id"]
    assert body["role"] == "AGENT"
    assert "workspace_id" not in body or body.get("id") == other["default_workspace_id"]

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["default_workspace_id"] == other["default_workspace_id"]
    current = next(
        item
        for item in me.json()["workspaces"]
        if item["id"] == me.json()["default_workspace_id"]
    )
    assert current["role"] == "AGENT"


@pytest.mark.asyncio
async def test_user_cannot_select_unrelated_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    original = me.json()["default_workspace_id"]
    other = await _register(client, _other_payload(sample_register_payload))

    denied = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=auth_headers,
    )
    assert denied.status_code == 404
    assert "not found" in denied.json()["detail"].lower()

    still = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert still.json()["default_workspace_id"] == original
    user = UserResponse.model_validate(still.json())
    context = await resolve_current_workspace(user)
    assert context.id == original


@pytest.mark.asyncio
async def test_inactive_membership_cannot_select_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user = await _register(client, sample_register_payload)
    other = await _register(client, _other_payload(sample_register_payload))
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
        role="AGENT",
        status="DISABLED",
    )
    token = (await _login(client, sample_register_payload))["access_token"]
    headers = _headers(token)
    original = user["default_workspace_id"]

    denied = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert denied.status_code == 404

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["default_workspace_id"] == original


@pytest.mark.asyncio
async def test_failed_selection_does_not_change_active_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    created = await client.post(
        "/api/v1/customers",
        headers=auth_headers,
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "ada@acme.example",
        },
    )
    assert created.status_code == 201
    original = (await client.get("/api/v1/auth/me", headers=auth_headers)).json()[
        "default_workspace_id"
    ]
    other = await _register(client, _other_payload(sample_register_payload))

    await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=auth_headers,
    )
    listed = await client.get("/api/v1/customers", headers=auth_headers)
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["items"]]
    assert created.json()["id"] in ids
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.json()["default_workspace_id"] == original


@pytest.mark.asyncio
async def test_get_current_workspace_resolves_selected_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user = await _register(client, sample_register_payload)
    other = await _register(client, _other_payload(sample_register_payload))
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
        role="ADMIN",
    )
    token = (await _login(client, sample_register_payload))["access_token"]
    headers = _headers(token)

    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200
    me = await client.get("/api/v1/auth/me", headers=headers)
    user_response = UserResponse.model_validate(me.json())
    context = await resolve_current_workspace(user_response)
    assert context.id == other["default_workspace_id"]
    assert context.role == "ADMIN"
    assert context.id != user["id"]


@pytest.mark.asyncio
async def test_single_workspace_users_keep_personal_workspace(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user = UserResponse.model_validate(me.json())
    context = await resolve_current_workspace(user)
    assert context.id == me.json()["default_workspace_id"]
    assert context.role == "OWNER"
    stored = await mongodb_module._database.users.find_one({"_id": user.id})
    assert stored["default_workspace_id"] == context.id


@pytest.mark.asyncio
async def test_selected_workspace_is_not_encoded_in_jwt(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user = await _register(client, sample_register_payload)
    other = await _register(client, _other_payload(sample_register_payload))
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
        role="AGENT",
    )
    login = await _login(client, sample_register_payload)
    headers = _headers(login["access_token"])
    await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )

    payload = decode_access_token(login["access_token"])
    assert payload["sub"] == user["id"]
    assert payload["type"] == "access"
    assert "workspace_id" not in payload
    assert "default_workspace_id" not in payload
    assert "role" not in payload


@pytest.mark.asyncio
async def test_workspace_scoped_resources_follow_selected_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user = await _register(client, sample_register_payload)
    other = await _register(client, _other_payload(sample_register_payload))
    workspace_a = user["default_workspace_id"]
    workspace_b = other["default_workspace_id"]
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=workspace_b,
        role="AGENT",
    )
    token = (await _login(client, sample_register_payload))["access_token"]
    headers = _headers(token)

    created_a = await client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "ada-a@acme.example",
        },
    )
    assert created_a.status_code == 201
    assert created_a.json()["workspace_id"] == workspace_a

    switched = await client.post(
        f"/api/v1/workspaces/{workspace_b}/select",
        headers=headers,
    )
    assert switched.status_code == 200

    listed_b = await client.get("/api/v1/customers", headers=headers)
    assert listed_b.status_code == 200
    ids_b = [item["id"] for item in listed_b.json()["items"]]
    assert created_a.json()["id"] not in ids_b

    created_b = await client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "first_name": "Ben",
            "last_name": "Byte",
            "email": "ben-b@acme.example",
        },
    )
    assert created_b.status_code == 201
    assert created_b.json()["workspace_id"] == workspace_b

    restored = await client.post(
        f"/api/v1/workspaces/{workspace_a}/select",
        headers=headers,
    )
    assert restored.status_code == 200
    listed_a = await client.get("/api/v1/customers", headers=headers)
    ids_a = [item["id"] for item in listed_a.json()["items"]]
    assert created_a.json()["id"] in ids_a
    assert created_b.json()["id"] not in ids_a


@pytest.mark.asyncio
async def test_invalid_selected_workspace_falls_back_to_accessible_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]
    original = me.json()["default_workspace_id"]
    await mongodb_module._database.users.update_one(
        {"_id": user_id},
        {"$set": {"default_workspace_id": "missing-workspace"}},
    )
    user = UserResponse.model_validate(
        {**me.json(), "default_workspace_id": "missing-workspace"},
    )
    context = await resolve_current_workspace(user)
    assert context.id == original
    stored = await mongodb_module._database.users.find_one({"_id": user_id})
    assert stored["default_workspace_id"] == original


@pytest.mark.asyncio
async def test_select_does_not_accept_workspace_id_body(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    user = await _register(client, sample_register_payload)
    other = await _register(client, _other_payload(sample_register_payload))
    token = (await _login(client, sample_register_payload))["access_token"]
    headers = _headers(token)

    denied = await client.post(
        f"/api/v1/workspaces/{user['default_workspace_id']}/select",
        headers=headers,
        json={"workspace_id": other["default_workspace_id"]},
    )
    assert denied.status_code == 200
    assert denied.json()["id"] == user["default_workspace_id"]
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["default_workspace_id"] == user["default_workspace_id"]
