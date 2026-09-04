"""Production-safe JWT and debug/docs configuration."""

import pytest

from app.config.settings import (
    PRODUCTION_JWT_SECRET_ERROR,
    ProductionSettingsError,
    Settings,
    apply_runtime_security_policy,
    get_settings,
    is_unsafe_jwt_secret,
)
from main import create_app

TEST_PRODUCTION_JWT_SECRET = "test-only-valid-production-jwt-secret-key"
TEST_PLACEHOLDER_JWT_SECRET = "change-me-to-a-long-random-secret"


def _isolated_settings(**overrides) -> Settings:
    """Build Settings without reading backend/.env."""
    values = {
        "app_env": "development",
        "app_debug": False,
        "jwt_secret": TEST_PLACEHOLDER_JWT_SECRET,
        **overrides,
    }
    return Settings(_env_file=None, **values)


def _route_paths(app: object) -> set[str]:
    return {
        str(getattr(route, "path", ""))
        for route in getattr(app, "routes", [])
    }


def test_development_accepts_placeholder_jwt_secret() -> None:
    settings = apply_runtime_security_policy(
        _isolated_settings(
            app_env="development",
            jwt_secret=TEST_PLACEHOLDER_JWT_SECRET,
            app_debug=True,
        )
    )
    assert settings.is_development
    assert settings.app_debug is True


def test_development_create_app_exposes_docs() -> None:
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
        assert app.debug is True
        assert app.docs_url == "/docs"
        assert app.redoc_url == "/redoc"
        assert app.openapi_url == "/openapi.json"
        paths = _route_paths(app)
        assert "/docs" in paths
        assert "/redoc" in paths
        assert "/openapi.json" in paths
        assert "/health" in paths
    finally:
        main_module.get_settings = original  # type: ignore[method-assign]
        get_settings.cache_clear()


def test_production_missing_jwt_secret_fails_closed() -> None:
    settings = _isolated_settings(app_env="production", jwt_secret="")
    with pytest.raises(ProductionSettingsError, match="JWT_SECRET") as exc_info:
        apply_runtime_security_policy(settings)
    assert str(exc_info.value) == PRODUCTION_JWT_SECRET_ERROR


def test_production_whitespace_jwt_secret_fails_closed() -> None:
    settings = _isolated_settings(app_env="production", jwt_secret="   ")
    with pytest.raises(ProductionSettingsError, match="JWT_SECRET"):
        apply_runtime_security_policy(settings)


def test_production_placeholder_jwt_secret_fails_closed() -> None:
    settings = _isolated_settings(
        app_env="production",
        jwt_secret=TEST_PLACEHOLDER_JWT_SECRET,
    )
    with pytest.raises(ProductionSettingsError) as exc_info:
        apply_runtime_security_policy(settings)
    message = str(exc_info.value)
    assert "JWT_SECRET" in message
    assert TEST_PLACEHOLDER_JWT_SECRET not in message


def test_production_default_development_placeholder_fails_closed() -> None:
    settings = _isolated_settings(
        app_env="production",
        jwt_secret="change-me-in-production-use-a-long-random-secret",
    )
    with pytest.raises(ProductionSettingsError):
        apply_runtime_security_policy(settings)


def test_production_valid_jwt_secret_is_accepted() -> None:
    settings = apply_runtime_security_policy(
        _isolated_settings(
            app_env="production",
            jwt_secret=TEST_PRODUCTION_JWT_SECRET,
            app_debug=True,
        )
    )
    assert settings.is_production
    assert settings.jwt_secret == TEST_PRODUCTION_JWT_SECRET
    assert settings.app_debug is False


def test_production_forces_debug_off_and_hides_docs() -> None:
    get_settings.cache_clear()
    settings = apply_runtime_security_policy(
        _isolated_settings(
            app_env="production",
            jwt_secret=TEST_PRODUCTION_JWT_SECRET,
            app_debug=True,
        )
    )

    def _settings() -> Settings:
        return settings

    import main as main_module

    original = main_module.get_settings
    main_module.get_settings = _settings  # type: ignore[method-assign]
    try:
        app = create_app()
        assert app.debug is False
        assert app.docs_url is None
        assert app.redoc_url is None
        assert app.openapi_url is None
        paths = _route_paths(app)
        assert "/docs" not in paths
        assert "/redoc" not in paths
        assert "/openapi.json" not in paths
        assert "/health" in paths
    finally:
        main_module.get_settings = original  # type: ignore[method-assign]
        get_settings.cache_clear()


def test_unsafe_jwt_secret_helper_does_not_require_real_secrets() -> None:
    assert is_unsafe_jwt_secret(None) is True
    assert is_unsafe_jwt_secret("") is True
    assert is_unsafe_jwt_secret(TEST_PLACEHOLDER_JWT_SECRET) is True
    assert is_unsafe_jwt_secret(TEST_PRODUCTION_JWT_SECRET) is False
