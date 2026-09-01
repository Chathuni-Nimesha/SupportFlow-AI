"""Authentication endpoint rate-limit tests."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.config.settings import Settings
from app.core.rate_limit import (
    AUTH_RATE_LIMIT_DETAIL,
    InMemoryRateLimiter,
    auth_rate_limit_keys,
    enforce_auth_rate_limit,
    reset_auth_rate_limiter,
)

TEST_PASSWORD = "securepass123"
TEST_REGISTER = {
    "first_name": "Maya",
    "last_name": "Chen",
    "company_name": "Acme Support",
    "email": "maya@acme.example",
    "password": TEST_PASSWORD,
}


class FakeClock:
    def __init__(self, start: float = 1_000.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now


def _tiny_auth_limits(**overrides) -> Settings:
    values = {
        "jwt_secret": "test-only-jwt-secret-key",
        "auth_login_rate_limit": 2,
        "auth_login_rate_window_seconds": 10,
        "auth_register_rate_limit": 2,
        "auth_register_rate_window_seconds": 10,
        **overrides,
    }
    return Settings(_env_file=None, **values)


def test_limiter_allows_requests_below_the_limit() -> None:
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    assert limiter.allow("login:ip:1.1.1.1", 2, 10) is None
    assert limiter.allow("login:ip:1.1.1.1", 2, 10) is None


def test_limiter_enforces_limit_and_resets_after_window() -> None:
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    assert limiter.allow("k", 2, 10) is None
    assert limiter.allow("k", 2, 10) is None
    retry = limiter.allow("k", 2, 10)
    assert retry is not None
    assert retry >= 1
    clock.now += 11
    assert limiter.allow("k", 2, 10) is None


def test_limiter_isolates_different_keys() -> None:
    limiter = InMemoryRateLimiter(clock=FakeClock())
    assert limiter.allow("login:ip:1.1.1.1", 1, 10) is None
    assert limiter.allow("login:ip:1.1.1.1", 1, 10) is not None
    assert limiter.allow("login:ip:8.8.8.8", 1, 10) is None


def test_rate_limit_keys_include_ip_and_email() -> None:
    keys = auth_rate_limit_keys("login", "10.0.0.1", "Maya@Acme.example")
    assert keys[0] == "login:ip:10.0.0.1"
    assert keys[1] == "login:ip:10.0.0.1:email:maya@acme.example"


def test_enforce_returns_safe_429(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = FakeClock()
    reset_auth_rate_limiter(InMemoryRateLimiter(clock=clock))
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_auth_limits(),
    )
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))
    enforce_auth_rate_limit("login", request, "a@example.com")  # type: ignore[arg-type]
    enforce_auth_rate_limit("login", request, "a@example.com")  # type: ignore[arg-type]
    with pytest.raises(HTTPException) as exc_info:
        enforce_auth_rate_limit("login", request, "a@example.com")  # type: ignore[arg-type]
    error = exc_info.value
    assert error.status_code == 429
    assert error.detail == AUTH_RATE_LIMIT_DETAIL
    assert TEST_PASSWORD not in str(error.detail)
    assert "password" not in str(error.detail).lower()
    reset_auth_rate_limiter()


@pytest.mark.asyncio
async def test_login_below_limit_still_authenticates(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_auth_limits(),
    )
    await client.post("/api/v1/auth/register", json=TEST_REGISTER)
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": TEST_REGISTER["email"], "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


@pytest.mark.asyncio
async def test_login_rate_limit_returns_429(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_auth_limits(auth_login_rate_limit=2),
    )
    await client.post("/api/v1/auth/register", json=TEST_REGISTER)
    payload = {"email": TEST_REGISTER["email"], "password": "wrong-password"}
    first = await client.post("/api/v1/auth/login", json=payload)
    second = await client.post("/api/v1/auth/login", json=payload)
    third = await client.post("/api/v1/auth/login", json=payload)
    assert first.status_code == 401
    assert second.status_code == 401
    assert third.status_code == 429
    body = third.json()
    assert body["detail"] == AUTH_RATE_LIMIT_DETAIL
    assert "Retry-After" in third.headers
    dumped = third.text.lower()
    assert "password" not in dumped
    assert TEST_PASSWORD not in third.text
    assert "already exists" not in dumped


@pytest.mark.asyncio
async def test_login_limit_resets_when_window_elapses(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = FakeClock()
    reset_auth_rate_limiter(InMemoryRateLimiter(clock=clock))
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_auth_limits(auth_login_rate_limit=1, auth_login_rate_window_seconds=10),
    )
    await client.post("/api/v1/auth/register", json=TEST_REGISTER)
    payload = {"email": TEST_REGISTER["email"], "password": "wrong-password"}
    assert (await client.post("/api/v1/auth/login", json=payload)).status_code == 401
    assert (await client.post("/api/v1/auth/login", json=payload)).status_code == 429
    clock.now += 11
    assert (await client.post("/api/v1/auth/login", json=payload)).status_code == 401


@pytest.mark.asyncio
async def test_login_clients_are_isolated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = FakeClock()
    reset_auth_rate_limiter(InMemoryRateLimiter(clock=clock))
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_auth_limits(auth_login_rate_limit=1),
    )
    request_a = SimpleNamespace(client=SimpleNamespace(host="10.0.0.1"))
    request_b = SimpleNamespace(client=SimpleNamespace(host="10.0.0.2"))
    enforce_auth_rate_limit("login", request_a, "shared@example.com")  # type: ignore[arg-type]
    with pytest.raises(HTTPException) as blocked:
        enforce_auth_rate_limit("login", request_a, "shared@example.com")  # type: ignore[arg-type]
    assert blocked.value.status_code == 429
    enforce_auth_rate_limit("login", request_b, "shared@example.com")  # type: ignore[arg-type]
    reset_auth_rate_limiter()


@pytest.mark.asyncio
async def test_register_below_limit_still_creates_user(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_auth_limits(),
    )
    response = await client.post("/api/v1/auth/register", json=TEST_REGISTER)
    assert response.status_code == 201
    assert response.json()["email"] == TEST_REGISTER["email"]


@pytest.mark.asyncio
async def test_register_rate_limit_returns_429(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.rate_limit.get_settings",
        lambda: _tiny_auth_limits(auth_register_rate_limit=2),
    )
    first = await client.post("/api/v1/auth/register", json=TEST_REGISTER)
    second_payload = {**TEST_REGISTER, "email": "other@acme.example"}
    second = await client.post("/api/v1/auth/register", json=second_payload)
    third_payload = {**TEST_REGISTER, "email": "third@acme.example"}
    third = await client.post("/api/v1/auth/register", json=third_payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert third.status_code == 429
    assert third.json()["detail"] == AUTH_RATE_LIMIT_DETAIL
    assert TEST_PASSWORD not in third.text
    assert "password" not in third.text.lower()
