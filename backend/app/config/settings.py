"""Environment-backed application settings."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Always load backend/.env regardless of the process working directory.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _BACKEND_ROOT / ".env"

_PRODUCTION_ENVS = frozenset({"production", "prod"})
_DEVELOPMENT_ENVS = frozenset({"development", "dev", "local"})

# Known unsafe placeholders — never log or raise the actual configured secret.
_UNSAFE_JWT_SECRETS = frozenset(
    {
        "change-me-to-a-long-random-secret",
        "change-me-in-production-use-a-long-random-secret",
        "changeme",
        "secret",
        "jwt_secret",
        "your_jwt_secret_here",
    }
)
_DEVELOPMENT_JWT_PLACEHOLDER = (
    "change-me-in-production-use-a-long-random-secret"
)

PRODUCTION_JWT_SECRET_ERROR = (
    "JWT_SECRET must be set to a unique non-placeholder value "
    "when APP_ENV=production."
)

PRODUCTION_CHROMA_HTTP_ERROR = (
    "Production CHROMA_MODE=http requires a private Chroma endpoint. "
    "Use a loopback host (localhost or 127.0.0.1), or set CHROMA_SSL "
    "and/or CHROMA_AUTH_TOKEN. Do not point at a publicly reachable "
    "unauthenticated Chroma server."
)

_LOOPBACK_CHROMA_HOSTS = frozenset(
    {
        "localhost",
        "127.0.0.1",
        "::1",
        "0:0:0:0:0:0:0:1",
        "[::1]",
    }
)
_UNSPECIFIED_CHROMA_HOSTS = frozenset({"", "0.0.0.0", "::", "[::]", "*"})
_ALLOWED_CHROMA_AUTH_HEADERS = frozenset({"Authorization", "X-Chroma-Token"})


class ProductionSettingsError(ValueError):
    """Raised when production configuration is unsafe."""


def is_production_env(app_env: str) -> bool:
    return (app_env or "").strip().lower() in _PRODUCTION_ENVS


def is_unsafe_jwt_secret(secret: str | None) -> bool:
    """Return True when a JWT secret is missing, blank, or a known placeholder."""
    cleaned = (secret or "").strip()
    if not cleaned:
        return True
    lowered = cleaned.lower()
    if lowered in _UNSAFE_JWT_SECRETS:
        return True
    if lowered.startswith("change-me"):
        return True
    if lowered.startswith("your_"):
        return True
    return False


def is_loopback_chroma_host(host: str | None) -> bool:
    cleaned = (host or "").strip().lower().rstrip(".")
    if cleaned in _LOOPBACK_CHROMA_HOSTS:
        return True
    return cleaned.startswith("127.")


def is_unspecified_chroma_host(host: str | None) -> bool:
    return (host or "").strip().lower() in _UNSPECIFIED_CHROMA_HOSTS


def normalize_chroma_auth_header(header: str | None) -> str:
    cleaned = (header or "").strip() or "Authorization"
    if cleaned in _ALLOWED_CHROMA_AUTH_HEADERS:
        return cleaned
    return "Authorization"


def validate_production_chroma(settings: "Settings") -> None:
    """Reject production HTTP Chroma configs that look publicly unauthenticated."""
    mode = (settings.chroma_mode or "").strip().lower()
    if mode != "http":
        return

    host = settings.chroma_host
    if is_unspecified_chroma_host(host):
        raise ProductionSettingsError(PRODUCTION_CHROMA_HTTP_ERROR)
    if is_loopback_chroma_host(host):
        return

    has_ssl = bool(settings.chroma_ssl)
    has_token = bool((settings.chroma_auth_token or "").strip())
    if not has_ssl and not has_token:
        raise ProductionSettingsError(PRODUCTION_CHROMA_HTTP_ERROR)


def apply_runtime_security_policy(settings: "Settings") -> "Settings":
    """Fail closed in production: require a real JWT secret and disable debug."""
    if settings.is_production:
        if is_unsafe_jwt_secret(settings.jwt_secret):
            raise ProductionSettingsError(PRODUCTION_JWT_SECRET_ERROR)
        settings.app_debug = False
        validate_production_chroma(settings)
    return settings


class Settings(BaseSettings):
    """Central configuration loaded from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    # Application
    app_name: str = Field(default="SupportFlow AI", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=False, alias="APP_DEBUG")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")

    # CORS — comma-separated origins in .env (not JSON)
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        alias="CORS_ORIGINS",
    )

    # MongoDB — canonical env var is MONGODB_URI (MONGODB_URL kept as fallback)
    mongodb_uri: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices("MONGODB_URI", "MONGODB_URL"),
    )
    mongodb_db_name: str = Field(
        default="supportflow_ai",
        validation_alias=AliasChoices("MONGODB_DATABASE", "MONGODB_DB_NAME"),
    )

    # JWT
    jwt_secret: str = Field(
        default=_DEVELOPMENT_JWT_PLACEHOLDER,
        alias="JWT_SECRET",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=60, alias="JWT_EXPIRE_MINUTES")

    # ChromaDB
    chroma_host: str = Field(default="localhost", alias="CHROMA_HOST")
    chroma_port: int = Field(default=8001, alias="CHROMA_PORT")
    chroma_collection: str = Field(
        default="supportflow_knowledge",
        alias="CHROMA_COLLECTION",
    )
    chroma_mode: str = Field(default="http", alias="CHROMA_MODE")
    chroma_persist_directory: str = Field(
        default=".chroma",
        alias="CHROMA_PERSIST_DIRECTORY",
    )
    # default = Chroma DefaultEmbeddingFunction (all-MiniLM-L6-v2)
    # hash = deterministic local vectors for tests / offline
    chroma_embedding_model: str = Field(
        default="default",
        alias="CHROMA_EMBEDDING_MODEL",
    )
    chroma_ssl: bool = Field(default=False, alias="CHROMA_SSL")
    chroma_auth_token: str = Field(default="", alias="CHROMA_AUTH_TOKEN")
    chroma_auth_header: str = Field(
        default="Authorization",
        alias="CHROMA_AUTH_HEADER",
    )

    # Google Gemini (generation only — embeddings remain MiniLM via Chroma)
    google_api_key: str = Field(default="", alias="GOOGLE_API_KEY")
    gemini_model: str = Field(
        default="gemini-3.5-flash-lite",
        alias="GEMINI_MODEL",
    )

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Auth endpoint throttling (in-memory, single-process only)
    auth_login_rate_limit: int = Field(default=30, alias="AUTH_LOGIN_RATE_LIMIT")
    auth_login_rate_window_seconds: int = Field(
        default=60,
        alias="AUTH_LOGIN_RATE_WINDOW_SECONDS",
    )
    auth_register_rate_limit: int = Field(
        default=20,
        alias="AUTH_REGISTER_RATE_LIMIT",
    )
    auth_register_rate_window_seconds: int = Field(
        default=60,
        alias="AUTH_REGISTER_RATE_WINDOW_SECONDS",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in _DEVELOPMENT_ENVS

    @property
    def is_production(self) -> bool:
        return is_production_env(self.app_env)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance with production safety applied."""
    return apply_runtime_security_policy(Settings())
