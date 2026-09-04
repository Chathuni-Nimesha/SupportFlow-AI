"""AI and knowledge-search rate-limit tests."""

import pytest
from httpx import AsyncClient

from app.config.settings import Settings
from app.core.rate_limit import (
    AI_RATE_LIMIT_DETAIL,
    SEARCH_RATE_LIMIT_DETAIL,
    InMemoryRateLimiter,
    enforce_ai_rate_limit,
    reset_auth_rate_limiter,
)
from app.core.security import decode_access_token
from app.database import mongodb as mongodb_module
from app.models.team_member import build_team_member_document


def _tiny_ai_limits(**overrides) -> Settings:
    values = {
        "jwt_secret": "test-only-jwt-secret-key",
        "ai_rate_limit": 1,
        "ai_workspace_rate_limit": 1000,
        "ai_rate_window_seconds": 60,
        "search_rate_limit": 1,
        "search_workspace_rate_limit": 1000,
        "search_rate_window_seconds": 60,
        **overrides,
    }
    return Settings(_env_file=None, **values)


async def _register(client: AsyncClient, payload: dict) -> dict:
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def _login_headers(client: AsyncClient, payload: dict) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _add_active_membership(
    *,
    owner_id: str,
    user: dict,
    workspace_id: str,
    role: str = "AGENT",
) -> None:
    member = build_team_member_document(
        owner_id=owner_id,
        user_id=user["id"],
        first_name=user["first_name"],
        last_name=user["last_name"],
        email=user["email"],
        role=role,
        status="ACTIVE",
        workspace_id=workspace_id,
    )
    await mongodb_module._database.team_members.insert_one(member)


@pytest.mark.asyncio
async def test_ai_answer_returns_429_when_user_exceeds_limit(
    client: AsyncClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(),
    )
    payload = {"question": "What is the refund window?"}
    first = await client.post(
        "/api/v1/ai/answer",
        headers=auth_headers,
        json=payload,
    )
    second = await client.post(
        "/api/v1/ai/answer",
        headers=auth_headers,
        json=payload,
    )
    assert first.status_code != 429
    assert second.status_code == 429
    assert second.json()["detail"] == AI_RATE_LIMIT_DETAIL
    assert "Retry-After" in second.headers


@pytest.mark.asyncio
async def test_ai_limits_are_isolated_per_user(
    client: AsyncClient,
    auth_headers: dict[str, str],
    sample_register_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(),
    )
    other_payload = {**sample_register_payload, "email": "other-ai@acme.example"}
    await _register(client, other_payload)
    other_headers = await _login_headers(client, other_payload)
    payload = {"question": "What is the refund window?"}
    first = await client.post(
        "/api/v1/ai/answer",
        headers=auth_headers,
        json=payload,
    )
    other = await client.post(
        "/api/v1/ai/answer",
        headers=other_headers,
        json=payload,
    )
    blocked = await client.post(
        "/api/v1/ai/answer",
        headers=auth_headers,
        json=payload,
    )
    assert first.status_code != 429
    assert other.status_code != 429
    assert blocked.status_code == 429


@pytest.mark.asyncio
async def test_ai_workspace_quota_is_shared_in_the_same_workspace(
    client: AsyncClient,
    sample_register_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(
            ai_rate_limit=100,
            ai_workspace_rate_limit=1,
        ),
    )
    owner_payload = {**sample_register_payload, "email": "ai-owner@acme.example"}
    member_payload = {**sample_register_payload, "email": "ai-member@acme.example"}
    owner = await _register(client, owner_payload)
    member = await _register(client, member_payload)
    await _add_active_membership(
        owner_id=owner["id"],
        user=member,
        workspace_id=owner["default_workspace_id"],
    )
    owner_headers = await _login_headers(client, owner_payload)
    member_headers = await _login_headers(client, member_payload)
    selected = await client.post(
        f"/api/v1/workspaces/{owner['default_workspace_id']}/select",
        headers=member_headers,
    )
    assert selected.status_code == 200, selected.text

    payload = {"question": "What is the refund window?"}
    first = await client.post(
        "/api/v1/ai/answer",
        headers=owner_headers,
        json=payload,
    )
    second = await client.post(
        "/api/v1/ai/answer",
        headers=member_headers,
        json=payload,
    )
    assert first.status_code != 429
    assert second.status_code == 429
    assert second.json()["detail"] == AI_RATE_LIMIT_DETAIL


@pytest.mark.asyncio
async def test_ai_workspace_quotas_are_independent(
    client: AsyncClient,
    sample_register_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(
            ai_rate_limit=100,
            ai_workspace_rate_limit=1,
        ),
    )
    user_payload = {**sample_register_payload, "email": "ai-switch@acme.example"}
    other_payload = {**sample_register_payload, "email": "ai-other@acme.example"}
    user = await _register(client, user_payload)
    other = await _register(client, other_payload)
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
    )
    headers = await _login_headers(client, user_payload)
    payload = {"question": "What is the refund window?"}

    first = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json=payload,
    )
    blocked_same = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json=payload,
    )
    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    other_workspace = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json=payload,
    )
    assert first.status_code != 429
    assert blocked_same.status_code == 429
    assert other_workspace.status_code != 429


@pytest.mark.asyncio
async def test_ai_user_limit_still_applies_across_workspaces(
    client: AsyncClient,
    sample_register_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(
            ai_rate_limit=1,
            ai_workspace_rate_limit=100,
        ),
    )
    user_payload = {**sample_register_payload, "email": "ai-abuse@acme.example"}
    other_payload = {**sample_register_payload, "email": "ai-abuse-other@acme.example"}
    user = await _register(client, user_payload)
    other = await _register(client, other_payload)
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
    )
    headers = await _login_headers(client, user_payload)
    payload = {"question": "What is the refund window?"}
    first = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json=payload,
    )
    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    second = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json=payload,
    )
    assert first.status_code != 429
    assert second.status_code == 429


@pytest.mark.asyncio
async def test_client_workspace_id_cannot_alter_ai_rate_limit_identity(
    client: AsyncClient,
    sample_register_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(
            ai_rate_limit=100,
            ai_workspace_rate_limit=1,
        ),
    )
    user_payload = {**sample_register_payload, "email": "ai-spoof@acme.example"}
    other_payload = {**sample_register_payload, "email": "ai-spoof-other@acme.example"}
    user = await _register(client, user_payload)
    other = await _register(client, other_payload)
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": user_payload["email"],
            "password": user_payload["password"],
        },
    )
    token = login.json()["access_token"]
    payload = decode_access_token(token)
    assert "workspace_id" not in payload
    assert "default_workspace_id" not in payload

    headers = {"Authorization": f"Bearer {token}"}
    spoofed = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json={
            "question": "What is the refund window?",
            "workspace_id": other["default_workspace_id"],
        },
    )
    blocked = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json={
            "question": "What is the refund window?",
            "workspace_id": other["default_workspace_id"],
        },
    )
    assert spoofed.status_code != 429
    assert blocked.status_code == 429

    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    other_workspace = await client.post(
        "/api/v1/ai/answer",
        headers=headers,
        json={
            "question": "What is the refund window?",
            "workspace_id": user["default_workspace_id"],
        },
    )
    assert other_workspace.status_code != 429


@pytest.mark.asyncio
async def test_knowledge_search_returns_429_when_user_exceeds_limit(
    client: AsyncClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(),
    )
    payload = {"query": "refund window", "top_k": 3}
    first = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json=payload,
    )
    second = await client.post(
        "/api/v1/knowledge/search",
        headers=auth_headers,
        json=payload,
    )
    assert first.status_code != 429
    assert second.status_code == 429
    assert second.json()["detail"] == SEARCH_RATE_LIMIT_DETAIL
    assert "Retry-After" in second.headers


@pytest.mark.asyncio
async def test_knowledge_search_workspace_quotas_are_independent(
    client: AsyncClient,
    sample_register_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(
            search_rate_limit=100,
            search_workspace_rate_limit=1,
        ),
    )
    user_payload = {**sample_register_payload, "email": "search-switch@acme.example"}
    other_payload = {**sample_register_payload, "email": "search-other@acme.example"}
    user = await _register(client, user_payload)
    other = await _register(client, other_payload)
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
    )
    headers = await _login_headers(client, user_payload)
    payload = {"query": "refund window", "top_k": 3}

    first = await client.post(
        "/api/v1/knowledge/search",
        headers=headers,
        json=payload,
    )
    blocked_same = await client.post(
        "/api/v1/knowledge/search",
        headers=headers,
        json=payload,
    )
    selected = await client.post(
        f"/api/v1/workspaces/{other['default_workspace_id']}/select",
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    other_workspace = await client.post(
        "/api/v1/knowledge/search",
        headers=headers,
        json=payload,
    )
    assert first.status_code != 429
    assert blocked_same.status_code == 429
    assert other_workspace.status_code != 429


@pytest.mark.asyncio
async def test_client_workspace_id_cannot_alter_search_rate_limit_identity(
    client: AsyncClient,
    sample_register_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(
            search_rate_limit=100,
            search_workspace_rate_limit=1,
        ),
    )
    user_payload = {**sample_register_payload, "email": "search-spoof@acme.example"}
    other_payload = {**sample_register_payload, "email": "search-spoof-other@acme.example"}
    user = await _register(client, user_payload)
    other = await _register(client, other_payload)
    await _add_active_membership(
        owner_id=other["id"],
        user=user,
        workspace_id=other["default_workspace_id"],
    )
    headers = await _login_headers(client, user_payload)
    spoofed = await client.post(
        "/api/v1/knowledge/search",
        headers=headers,
        json={
            "query": "refund window",
            "top_k": 3,
            "workspace_id": other["default_workspace_id"],
        },
    )
    blocked = await client.post(
        "/api/v1/knowledge/search",
        headers=headers,
        json={
            "query": "refund window",
            "top_k": 3,
            "workspace_id": other["default_workspace_id"],
        },
    )
    assert spoofed.status_code != 429
    assert blocked.status_code == 429


def test_ai_rate_limit_zero_disables_throttling(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reset_auth_rate_limiter(InMemoryRateLimiter())
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_ai_limits(ai_rate_limit=0, ai_workspace_rate_limit=0),
    )
    enforce_ai_rate_limit(user_id="user-1", workspace_id="workspace-1")
    enforce_ai_rate_limit(user_id="user-1", workspace_id="workspace-1")
    enforce_ai_rate_limit(user_id="user-1", workspace_id="workspace-1")
    reset_auth_rate_limiter()
