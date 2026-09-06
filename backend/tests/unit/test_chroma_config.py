"""Chroma HTTP configuration and production fail-closed checks."""

from types import SimpleNamespace

import pytest

from app.config.settings import (
    PRODUCTION_CHROMA_HTTP_ERROR,
    ProductionSettingsError,
    Settings,
    apply_runtime_security_policy,
    is_loopback_chroma_host,
    is_unspecified_chroma_host,
)
from app.database.chroma import http_chroma_client_kwargs, reset_chroma_client

TEST_PRODUCTION_JWT_SECRET = "test-only-valid-production-jwt-secret-key"
TEST_CHROMA_TOKEN = "test-only-chroma-token"
TEST_PRODUCTION_MONGODB_URI = "mongodb://mongo.internal:27017"


def _isolated_settings(**overrides) -> Settings:
    values = {
        "app_env": "development",
        "app_debug": False,
        "jwt_secret": TEST_PRODUCTION_JWT_SECRET,
        "chroma_mode": "http",
        "chroma_host": "localhost",
        "chroma_port": 8001,
        "chroma_ssl": False,
        "chroma_auth_token": "",
        **overrides,
    }
    env_name = str(values.get("app_env", "development")).lower()
    if env_name in {"production", "prod"} and "mongodb_uri" not in overrides:
        values["mongodb_uri"] = TEST_PRODUCTION_MONGODB_URI
    return Settings(_env_file=None, **values)


def test_development_chroma_defaults_are_loopback() -> None:
    settings = apply_runtime_security_policy(_isolated_settings())
    assert settings.chroma_mode == "http"
    assert is_loopback_chroma_host(settings.chroma_host)
    assert settings.chroma_ssl is False
    assert settings.chroma_auth_token == ""
    kwargs = http_chroma_client_kwargs(settings)
    assert kwargs["host"] == "localhost"
    assert kwargs["port"] == 8001
    assert kwargs["ssl"] is False
    assert "settings" not in kwargs


def test_loopback_and_unspecified_host_helpers() -> None:
    assert is_loopback_chroma_host("localhost") is True
    assert is_loopback_chroma_host("127.0.0.1") is True
    assert is_loopback_chroma_host("chroma.example.com") is False
    assert is_unspecified_chroma_host("0.0.0.0") is True
    assert is_unspecified_chroma_host("localhost") is False


def test_production_allows_loopback_http_chroma() -> None:
    settings = apply_runtime_security_policy(
        _isolated_settings(app_env="production", chroma_host="127.0.0.1")
    )
    assert settings.is_production
    kwargs = http_chroma_client_kwargs(settings)
    assert kwargs["host"] == "127.0.0.1"
    assert kwargs["ssl"] is False


def test_production_rejects_unspecified_chroma_host() -> None:
    settings = _isolated_settings(app_env="production", chroma_host="0.0.0.0")
    with pytest.raises(ProductionSettingsError) as exc_info:
        apply_runtime_security_policy(settings)
    assert str(exc_info.value) == PRODUCTION_CHROMA_HTTP_ERROR


def test_production_rejects_unsecured_remote_chroma() -> None:
    settings = _isolated_settings(
        app_env="production",
        chroma_host="chroma.internal.example",
        chroma_ssl=False,
        chroma_auth_token="",
    )
    with pytest.raises(ProductionSettingsError, match="CHROMA"):
        apply_runtime_security_policy(settings)


def test_production_allows_remote_chroma_with_ssl() -> None:
    settings = apply_runtime_security_policy(
        _isolated_settings(
            app_env="production",
            chroma_host="chroma.internal.example",
            chroma_ssl=True,
        )
    )
    kwargs = http_chroma_client_kwargs(settings)
    assert kwargs["ssl"] is True
    assert kwargs["host"] == "chroma.internal.example"


def test_production_allows_remote_chroma_with_token() -> None:
    settings = apply_runtime_security_policy(
        _isolated_settings(
            app_env="production",
            chroma_host="chroma.internal.example",
            chroma_auth_token=TEST_CHROMA_TOKEN,
        )
    )
    kwargs = http_chroma_client_kwargs(settings)
    assert kwargs["ssl"] is False
    chroma_settings = kwargs["settings"]
    assert chroma_settings.chroma_client_auth_credentials == TEST_CHROMA_TOKEN
    assert (
        chroma_settings.chroma_client_auth_provider
        == "chromadb.auth.token_authn.TokenAuthClientProvider"
    )
    assert chroma_settings.chroma_auth_token_transport_header == "Authorization"


def test_http_kwargs_pass_ssl_and_token_without_calling_chroma() -> None:
    settings = _isolated_settings(
        chroma_host="localhost",
        chroma_ssl=True,
        chroma_auth_token=TEST_CHROMA_TOKEN,
        chroma_auth_header="X-Chroma-Token",
    )
    kwargs = http_chroma_client_kwargs(settings)
    assert kwargs["ssl"] is True
    assert kwargs["settings"].chroma_auth_token_transport_header == "X-Chroma-Token"
    assert kwargs["settings"].chroma_client_auth_credentials == TEST_CHROMA_TOKEN


def test_persistent_mode_skips_http_production_check() -> None:
    settings = apply_runtime_security_policy(
        _isolated_settings(
            app_env="production",
            chroma_mode="persistent",
            chroma_host="0.0.0.0",
        )
    )
    assert settings.chroma_mode == "persistent"


def test_get_chroma_client_http_uses_built_kwargs(monkeypatch: pytest.MonkeyPatch) -> None:
    reset_chroma_client()
    captured: dict = {}

    def fake_http_client(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace()

    import chromadb

    monkeypatch.setattr(chromadb, "HttpClient", fake_http_client)
    monkeypatch.setattr(
        "app.database.chroma.get_settings",
        lambda: _isolated_settings(
            chroma_mode="http",
            chroma_host="localhost",
            chroma_ssl=True,
            chroma_auth_token=TEST_CHROMA_TOKEN,
        ),
    )

    from app.database.chroma import get_chroma_client

    client = get_chroma_client()
    assert client is not None
    assert captured["host"] == "localhost"
    assert captured["ssl"] is True
    assert captured["settings"].chroma_client_auth_credentials == TEST_CHROMA_TOKEN
    reset_chroma_client()
