"""Authenticate as an ACTIVE workspace member with a specific role."""

from __future__ import annotations

from httpx import AsyncClient

from app.database import mongodb as mongodb_module
from app.models.team_member import build_team_member_document


async def register_and_login(
    client: AsyncClient,
    payload: dict,
) -> tuple[dict, dict[str, str]]:
    registered = await client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code == 201, registered.text
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200, login.text
    return registered.json(), {
        "Authorization": f"Bearer {login.json()['access_token']}",
    }


async def headers_as_workspace_role(
    client: AsyncClient,
    sample_register_payload: dict,
    *,
    email: str,
    role: str,
    workspace_id: str,
    owner_id: str,
    first_name: str = "Pat",
    last_name: str = "Lee",
    company_name: str = "Orbit Co",
) -> tuple[dict, dict[str, str]]:
    """Login as ``role`` in ``workspace_id``.

    Disables the user's personal OWNER membership so
    ``get_current_workspace`` resolves to the target workspace.
    """
    payload = {
        **sample_register_payload,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "company_name": company_name,
    }
    user, headers = await register_and_login(client, payload)
    db = mongodb_module.get_database()
    await db.team_members.update_one(
        {"_id": user["id"], "role": "OWNER"},
        {"$set": {"status": "DISABLED"}},
    )
    member = build_team_member_document(
        owner_id=owner_id,
        user_id=user["id"],
        first_name=first_name,
        last_name=last_name,
        email=email,
        role=role,
        status="ACTIVE",
        workspace_id=workspace_id,
    )
    await db.team_members.insert_one(member)
    return user, headers
