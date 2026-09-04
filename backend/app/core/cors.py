"""CORS origin resolution for browser clients.

Credentials are always enabled on the API, so wildcard origins are never
allowed. Production origins come only from CORS_ORIGINS. Development also
allows local Vite ports (5173-5175) and Vite preview (4173).
"""

from __future__ import annotations

from app.config.settings import Settings

WILDCARD_ORIGIN_ERROR = (
    "CORS_ORIGINS cannot include '*' while credentialed requests are enabled."
)

# Vite may bind 5174/5175 when 5173 is occupied. Preview uses 4173.
_DEV_FRONTEND_ORIGINS = (
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:4173",
)

# Exact methods used by the agent UI. Avoid allowing every method.
CORS_ALLOW_METHODS = ("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
CORS_ALLOW_HEADERS = ("Authorization", "Content-Type", "Accept")


def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


def configured_cors_origins(settings: Settings) -> list[str]:
    """Origins from CORS_ORIGINS only (no development extras)."""
    origins: list[str] = []
    seen: set[str] = set()
    for raw in settings.cors_origins:
        origin = _normalize_origin(str(raw))
        if not origin or origin in seen:
            continue
        seen.add(origin)
        origins.append(origin)
    return origins


def resolve_cors_origins(settings: Settings) -> list[str]:
    """
    Return the allow-list used by CORSMiddleware.

    Raises ValueError if a wildcard is configured. FastAPI/Starlette reject
    credentialed preflight from unknown origins with HTTP 400 (the
    OPTIONS /api/v1/* 400 seen when Vite is on 5174/5175 or when tests leak
    a request to a live API with a disallowed Origin).
    """
    origins = configured_cors_origins(settings)
    if any(origin == "*" for origin in origins):
        raise ValueError(WILDCARD_ORIGIN_ERROR)

    if settings.is_development:
        seen = set(origins)
        for origin in _DEV_FRONTEND_ORIGINS:
            if origin not in seen:
                origins.append(origin)
                seen.add(origin)

    return origins
