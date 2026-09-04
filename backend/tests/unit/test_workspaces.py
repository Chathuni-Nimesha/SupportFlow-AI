"""Phase 1C workspace context and API tests."""

import pytest
from httpx import AsyncClient

from app.auth.deps import get_current_workspace
from app.core.security import decode_access_token
from app.database import mongodb as mongodb_module
from app.models.team_member import build_team_member_document
from app.schemas.auth import UserResponse
from app.services.workspace_service import resolve_current_workspace
from main import create_app


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


def _other_payload(sample_register_payload: dict) -> dict:
    return {
        **sample_register_payload,
        "email": "other@acme.example",
        "first_name": "Omar",
        "company_name": "Other Co",
    }


@pytest.mark.asyncio
async def test_registration_creates_user_workspace_and_owner(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    data = await _register(client, sample_register_payload)
    user_id = data["id"]
    workspace_id = data["default_workspace_id"]

    assert workspace_id
    assert workspace_id != user_id
    assert data["workspaces"][0]["id"] == workspace_id
    assert data["workspaces"][0]["name"] == "Acme Support"
    assert data["workspaces"][0]["role"] == "OWNER"

    db = mongodb_module._database
    workspace = await db.workspaces.find_one({"_id": workspace_id})
    assert workspace is not None
    assert workspace["owner_user_id"] == user_id
    assert workspace["_id"] != user_id

    owner = await db.team_members.find_one({"_id": user_id, "role": "OWNER"})
    assert owner is not None
    assert owner["user_id"] == user_id
    assert owner["owner_id"] == user_id
    assert owner["workspace_id"] == workspace_id
    assert owner["status"] == "ACTIVE"
    assert await db.team_members.count_documents({"role": "OWNER", "owner_id": user_id}) == 1


@pytest.mark.asyncio
async def test_auth_me_returns_workspace_information(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == sample_register_payload["email"]
    assert data["first_name"] == "Maya"
    assert data["default_workspace_id"]
    assert data["default_workspace_id"] != data["id"]
    assert len(data["workspaces"]) == 1
    assert data["workspaces"][0]["role"] == "OWNER"


@pytest.mark.asyncio
async def test_jwt_does_not_contain_workspace_id(
    client: AsyncClient,
    sample_register_payload: dict,
) -> None:
    registered = await _register(client, sample_register_payload)
    login = await _login(client, sample_register_payload)
    payload = decode_access_token(login["access_token"])
    assert payload["sub"] == registered["id"]
    assert payload["type"] == "access"
    assert "workspace_id" not in payload
    assert "default_workspace_id" not in payload


@pytest.mark.asyncio
async def test_list_workspaces_returns_only_member_workspaces(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    await _register(client, _other_payload(sample_register_payload))
    response = await client.get("/api/v1/workspaces", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["name"] == "Acme Support"
    assert body[0]["role"] == "OWNER"

    other_login = await _login(client, _other_payload(sample_register_payload))
    other_headers = {"Authorization": f"Bearer {other_login['access_token']}"}
    other_list = await client.get("/api/v1/workspaces", headers=other_headers)
    assert other_list.status_code == 200
    assert len(other_list.json()) == 1
    assert other_list.json()[0]["id"] != body[0]["id"]
    assert other_list.json()[0]["name"] == "Other Co"


@pytest.mark.asyncio
async def test_get_workspace_succeeds_for_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    listed = await client.get("/api/v1/workspaces", headers=auth_headers)
    workspace_id = listed.json()[0]["id"]
    response = await client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == workspace_id
    assert body["role"] == "OWNER"
    assert body["owner_user_id"]
    assert body["id"] != body["owner_user_id"]


@pytest.mark.asyncio
async def test_get_workspace_returns_404_for_non_member(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    other = await _register(client, _other_payload(sample_register_payload))
    other_workspace = other["default_workspace_id"]
    response = await client.get(
        f"/api/v1/workspaces/{other_workspace}",
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_patch_workspace_name_works_for_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    listed = await client.get("/api/v1/workspaces", headers=auth_headers)
    workspace_id = listed.json()[0]["id"]
    response = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=auth_headers,
        json={"name": "  Renamed Support  "},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Support"
    assert response.json()["role"] == "OWNER"

    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.json()["workspaces"][0]["name"] == "Renamed Support"


@pytest.mark.asyncio
async def test_blank_workspace_name_is_rejected(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    listed = await client.get("/api/v1/workspaces", headers=auth_headers)
    workspace_id = listed.json()[0]["id"]
    response = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=auth_headers,
        json={"name": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_agent_cannot_patch_workspace_name(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    listed = await client.get("/api/v1/workspaces", headers=auth_headers)
    workspace_id = listed.json()[0]["id"]
    owner = await client.get("/api/v1/auth/me", headers=auth_headers)
    owner_id = owner.json()["id"]

    other = await _register(client, _other_payload(sample_register_payload))
    member = build_team_member_document(
        owner_id=owner_id,
        user_id=other["id"],
        first_name="Omar",
        last_name="Chen",
        email=other["email"],
        role="AGENT",
        status="ACTIVE",
        workspace_id=workspace_id,
    )
    await mongodb_module._database.team_members.insert_one(member)

    other_login = await _login(client, _other_payload(sample_register_payload))
    other_headers = {"Authorization": f"Bearer {other_login['access_token']}"}
    forbidden = await client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=other_headers,
        json={"name": "Hacked"},
    )
    assert forbidden.status_code == 403

    allowed = await client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=other_headers,
    )
    assert allowed.status_code == 200
    assert allowed.json()["role"] == "AGENT"


@pytest.mark.asyncio
async def test_missing_owner_membership_is_repaired_without_duplicates(
    client: AsyncClient,
    sample_register_payload: dict,
    auth_headers: dict[str, str],
) -> None:
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]
    workspace_id = me.json()["default_workspace_id"]
    db = mongodb_module._database

    await db.team_members.delete_one({"_id": user_id, "role": "OWNER"})
    assert await db.team_members.count_documents({"role": "OWNER", "owner_id": user_id}) == 0

    repaired = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert repaired.status_code == 200
    assert repaired.json()["default_workspace_id"] == workspace_id
    assert repaired.json()["workspaces"][0]["role"] == "OWNER"

    owners = await db.team_members.find(
        {"role": "OWNER", "owner_id": user_id},
    ).to_list(length=10)
    assert len(owners) == 1
    assert owners[0]["_id"] == user_id
    assert owners[0]["user_id"] == user_id
    assert owners[0]["workspace_id"] == workspace_id


@pytest.mark.asyncio
async def test_owner_membership_id_preserved_when_workspace_id_missing(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]
    workspace_id = me.json()["default_workspace_id"]
    db = mongodb_module._database

    await db.team_members.update_one(
        {"_id": user_id},
        {"$unset": {"workspace_id": ""}},
    )
    owner_before = await db.team_members.find_one({"_id": user_id})
    assert "workspace_id" not in owner_before or not owner_before.get("workspace_id")

    repaired = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert repaired.status_code == 200
    owner_after = await db.team_members.find_one({"_id": user_id})
    assert owner_after["_id"] == user_id
    assert owner_after["user_id"] == user_id
    assert owner_after["owner_id"] == user_id
    assert owner_after["role"] == "OWNER"
    assert owner_after["status"] == "ACTIVE"
    assert owner_after["workspace_id"] == workspace_id
    assert repaired.json()["default_workspace_id"] == workspace_id
    assert await db.team_members.count_documents({"role": "OWNER", "owner_id": user_id}) == 1


@pytest.mark.asyncio
async def test_get_current_workspace_resolves_workspace_id_not_user_id(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user = UserResponse.model_validate(me.json())
    context = await resolve_current_workspace(user)
    assert context.id == me.json()["default_workspace_id"]
    assert context.id != user.id
    assert context.role == "OWNER"
    assert get_current_workspace.__name__ == "get_current_workspace"


@pytest.mark.asyncio
async def test_customer_create_uses_workspace_id_and_preserves_owner_id(
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
    customer = created.json()
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]
    workspace_id = me.json()["default_workspace_id"]
    assert customer["owner_id"] == user_id
    assert customer["workspace_id"] == workspace_id
    assert customer["workspace_id"] != user_id

    other = await _register(client, _other_payload(sample_register_payload))
    other_login = await _login(client, _other_payload(sample_register_payload))
    other_headers = {"Authorization": f"Bearer {other_login['access_token']}"}
    hidden = await client.get(
        f"/api/v1/customers/{customer['id']}",
        headers=other_headers,
    )
    assert hidden.status_code == 404
    assert other["id"] != user_id


def test_openapi_includes_workspace_routes_and_me_schema() -> None:
    app = create_app()
    spec = app.openapi()
    paths = spec["paths"]
    assert "/api/v1/workspaces" in paths
    assert "get" in paths["/api/v1/workspaces"]
    assert "/api/v1/workspaces/{workspace_id}" in paths
    assert "get" in paths["/api/v1/workspaces/{workspace_id}"]
    assert "patch" in paths["/api/v1/workspaces/{workspace_id}"]
    assert "/api/v1/workspaces/{workspace_id}/select" in paths
    assert "post" in paths["/api/v1/workspaces/{workspace_id}/select"]

    me_schema = paths["/api/v1/auth/me"]["get"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]
    ref = me_schema.get("$ref", "")
    assert "UserResponse" in ref
    user_schema = spec["components"]["schemas"]["UserResponse"]
    properties = user_schema["properties"]
    assert "default_workspace_id" in properties
    assert "workspaces" in properties
    assert "email" in properties
    assert "id" in properties
