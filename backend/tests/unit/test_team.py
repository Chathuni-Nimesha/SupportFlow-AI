"""Team member directory API tests."""

import pytest
from httpx import AsyncClient


SAMPLE_MEMBER = {
    "first_name": "Sarah",
    "last_name": "Perera",
    "email": "sarah@acme.example",
    "role": "AGENT",
    "status": "ACTIVE",
}


async def _create_member(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides,
) -> dict:
    payload = {**SAMPLE_MEMBER, **overrides}
    response = await client.post(
        "/api/v1/team",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _current_user(
    client: AsyncClient,
    headers: dict[str, str],
) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()


async def _other_owner_headers(
    client: AsyncClient,
    sample_register_payload: dict,
    email: str = "other-team@acme.example",
) -> dict[str, str]:
    other_payload = {**sample_register_payload, "email": email}
    await client.post("/api/v1/auth/register", json=other_payload)
    other_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": other_payload["email"],
            "password": other_payload["password"],
        },
    )
    return {"Authorization": f"Bearer {other_login.json()['access_token']}"}


@pytest.mark.asyncio
async def test_list_team_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/team")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_team_member_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/v1/team", json=SAMPLE_MEMBER)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_team_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await _create_member(client, auth_headers)
    assert created["first_name"] == "Sarah"
    assert created["last_name"] == "Perera"
    assert created["email"] == "sarah@acme.example"
    assert created["role"] == "AGENT"
    assert created["status"] == "ACTIVE"
    assert created["user_id"] is None
    assert "id" in created
    assert "owner_id" in created
    assert "created_at" in created
    assert "updated_at" in created


@pytest.mark.asyncio
async def test_list_team_includes_owner_record(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    listed = await client.get("/api/v1/team", headers=auth_headers)
    assert listed.status_code == 200
    members = listed.json()
    assert len(members) == 1
    owner = members[0]
    assert owner["id"] == me["id"]
    assert owner["user_id"] == me["id"]
    assert owner["role"] == "OWNER"
    assert owner["status"] == "ACTIVE"
    assert owner["email"] == me["email"]


@pytest.mark.asyncio
async def test_list_team_members(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    await _create_member(client, auth_headers)
    listed = await client.get("/api/v1/team", headers=auth_headers)
    assert listed.status_code == 200
    emails = {item["email"] for item in listed.json()}
    assert "sarah@acme.example" in emails
    assert any(item["role"] == "OWNER" for item in listed.json())


@pytest.mark.asyncio
async def test_get_team_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await _create_member(client, auth_headers)
    detail = await client.get(
        f"/api/v1/team/{created['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["id"] == created["id"]
    assert detail.json()["email"] == "sarah@acme.example"


@pytest.mark.asyncio
async def test_update_team_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await _create_member(client, auth_headers)
    updated = await client.patch(
        f"/api/v1/team/{created['id']}",
        headers=auth_headers,
        json={"role": "ADMIN", "first_name": "Sara"},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["role"] == "ADMIN"
    assert body["first_name"] == "Sara"
    assert body["last_name"] == "Perera"


@pytest.mark.asyncio
async def test_delete_team_member(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await _create_member(client, auth_headers)
    deleted = await client.delete(
        f"/api/v1/team/{created['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204

    missing = await client.get(
        f"/api/v1/team/{created['id']}",
        headers=auth_headers,
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_search_team_members(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    await _create_member(client, auth_headers)
    await _create_member(
        client,
        auth_headers,
        first_name="John",
        last_name="Silva",
        email="john@acme.example",
        role="ADMIN",
    )

    searched = await client.get(
        "/api/v1/team",
        headers=auth_headers,
        params={"q": "sarah"},
    )
    assert searched.status_code == 200
    emails = [item["email"] for item in searched.json()]
    assert emails == ["sarah@acme.example"]

    by_email = await client.get(
        "/api/v1/team",
        headers=auth_headers,
        params={"q": "john@acme"},
    )
    assert [item["first_name"] for item in by_email.json()] == ["John"]


@pytest.mark.asyncio
async def test_filter_team_members_by_role(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    await _create_member(client, auth_headers)
    await _create_member(
        client,
        auth_headers,
        email="admin@acme.example",
        role="ADMIN",
        first_name="John",
        last_name="Silva",
    )

    agents = await client.get(
        "/api/v1/team",
        headers=auth_headers,
        params={"role": "AGENT"},
    )
    assert agents.status_code == 200
    assert [item["email"] for item in agents.json()] == ["sarah@acme.example"]

    owners = await client.get(
        "/api/v1/team",
        headers=auth_headers,
        params={"role": "OWNER"},
    )
    assert owners.status_code == 200
    assert len(owners.json()) == 1
    assert owners.json()[0]["role"] == "OWNER"


@pytest.mark.asyncio
async def test_filter_team_members_by_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await _create_member(client, auth_headers)
    disabled = await client.patch(
        f"/api/v1/team/{created['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 200

    active = await client.get(
        "/api/v1/team",
        headers=auth_headers,
        params={"status": "ACTIVE"},
    )
    assert active.status_code == 200
    assert all(item["status"] == "ACTIVE" for item in active.json())
    assert created["email"] not in {item["email"] for item in active.json()}

    filtered = await client.get(
        "/api/v1/team",
        headers=auth_headers,
        params={"status": "DISABLED"},
    )
    assert [item["id"] for item in filtered.json()] == [created["id"]]


@pytest.mark.asyncio
async def test_create_team_member_rejects_invalid_email(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json={**SAMPLE_MEMBER, "email": "not-an-email"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_team_member_requires_name(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json={**SAMPLE_MEMBER, "first_name": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_team_member_rejects_owner_role(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json={**SAMPLE_MEMBER, "role": "OWNER"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_team_member_rejects_duplicate_email(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    await _create_member(client, auth_headers)
    duplicate = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json=SAMPLE_MEMBER,
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == (
        "A team member with this email already exists."
    )


@pytest.mark.asyncio
async def test_create_team_member_rejects_owner_email(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    await client.get("/api/v1/team", headers=auth_headers)
    duplicate = await client.post(
        "/api/v1/team",
        headers=auth_headers,
        json={**SAMPLE_MEMBER, "email": me["email"]},
    )
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_cannot_change_owner_role_or_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    await client.get("/api/v1/team", headers=auth_headers)

    demoted = await client.patch(
        f"/api/v1/team/{me['id']}",
        headers=auth_headers,
        json={"role": "ADMIN"},
    )
    assert demoted.status_code == 403

    disabled = await client.patch(
        f"/api/v1/team/{me['id']}",
        headers=auth_headers,
        json={"status": "DISABLED"},
    )
    assert disabled.status_code == 403


@pytest.mark.asyncio
async def test_cannot_delete_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    me = await _current_user(client, auth_headers)
    await client.get("/api/v1/team", headers=auth_headers)
    response = await client.delete(
        f"/api/v1/team/{me['id']}",
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "The workspace owner cannot be removed."


@pytest.mark.asyncio
async def test_update_team_member_rejects_empty_body(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await _create_member(client, auth_headers)
    response = await client.patch(
        f"/api/v1/team/{created['id']}",
        headers=auth_headers,
        json={},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_team_member_not_found(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.get(
        "/api/v1/team/does-not-exist",
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Team member not found."


@pytest.mark.asyncio
async def test_team_members_are_scoped_to_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
) -> None:
    created = await _create_member(client, auth_headers)
    member_id = created["id"]
    other_headers = await _other_owner_headers(
        client,
        sample_register_payload,
    )

    listed = await client.get("/api/v1/team", headers=other_headers)
    assert listed.status_code == 200
    assert created["email"] not in {item["email"] for item in listed.json()}
    assert all(item["role"] == "OWNER" for item in listed.json())

    detail = await client.get(
        f"/api/v1/team/{member_id}",
        headers=other_headers,
    )
    assert detail.status_code == 404

    patched = await client.patch(
        f"/api/v1/team/{member_id}",
        headers=other_headers,
        json={"first_name": "Stolen"},
    )
    assert patched.status_code == 404

    deleted = await client.delete(
        f"/api/v1/team/{member_id}",
        headers=other_headers,
    )
    assert deleted.status_code == 404
