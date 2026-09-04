"""CORS allow-list tests."""

import pytest
from fastapi.testclient import TestClient

from app.config.settings import Settings, apply_runtime_security_policy, get_settings
from app.core.cors import WILDCARD_ORIGIN_ERROR, resolve_cors_origins
from main import create_app

TEST_JWT_SECRET = "test-only-valid-production-jwt-secret-key"


def _isolated_settings(**overrides) -> Settings:
    values = {
        "app_env": "development",
        "app_debug": False,
        "jwt_secret": "change-me-to-a-long-random-secret",
        **overrides,
    }
    return Settings(_env_file=None, **values)


def test_development_includes_local_vite_ports() -> None:
    origins = resolve_cors_origins(
        _isolated_settings(cors_origins=["http://localhost:5173"]),
    )
    assert "http://localhost:5173" in origins
    assert "http://localhost:5174" in origins
    assert "http://localhost:5175" in origins
    assert "http://127.0.0.1:5174" in origins
    assert "*" not in origins


def test_production_does_not_add_vite_ports() -> None:
    origins = resolve_cors_origins(
        apply_runtime_security_policy(
            _isolated_settings(
                app_env="production",
                jwt_secret=TEST_JWT_SECRET,
                cors_origins=["https://app.example.com"],
            )
        )
    )
    assert origins == ["https://app.example.com"]
    assert "http://localhost:5174" not in origins


def test_wildcard_origin_is_rejected() -> None:
    with pytest.raises(ValueError, match="credentialed"):
        resolve_cors_origins(_isolated_settings(cors_origins=["*"]))
    assert "CORS_ORIGINS" in WILDCARD_ORIGIN_ERROR or "*" in WILDCARD_ORIGIN_ERROR


def test_preflight_allows_development_vite_port(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    settings = apply_runtime_security_policy(
        _isolated_settings(app_env="development", app_debug=True)
    )

    def _settings() -> Settings:
        return settings

    import main as main_module

    original = main_module.get_settings
    main_module.get_settings = _settings  # type: ignore[method-assign]
    try:
        app = create_app()
        http = TestClient(app)
        response = http.options(
            "/api/v1/tickets",
            headers={
                "Origin": "http://localhost:5174",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == (
            "http://localhost:5174"
        )
        assert response.headers.get("access-control-allow-credentials") == "true"
    finally:
        main_module.get_settings = original  # type: ignore[method-assign]
        get_settings.cache_clear()


def test_preflight_rejects_unknown_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    settings = apply_runtime_security_policy(
        _isolated_settings(app_env="development", app_debug=True)
    )

    def _settings() -> Settings:
        return settings

    import main as main_module

    original = main_module.get_settings
    main_module.get_settings = _settings  # type: ignore[method-assign]
    try:
        app = create_app()
        http = TestClient(app)
        response = http.options(
            "/api/v1/tickets",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 400
    finally:
        main_module.get_settings = original  # type: ignore[method-assign]
        get_settings.cache_clear()
