"""In-memory request throttling for authentication endpoints.

This limiter is process-local. It is appropriate for a single Uvicorn
worker. It does NOT share counters across processes, machines, or
replicas. Deployments with multiple workers need an external store.
"""

from __future__ import annotations

from collections.abc import Callable
from time import monotonic

from fastapi import HTTPException, Request, status

from app.config.settings import get_settings

AUTH_RATE_LIMIT_DETAIL = "Too many attempts. Please try again later."
AI_RATE_LIMIT_DETAIL = "Too many AI requests. Please try again later."
SEARCH_RATE_LIMIT_DETAIL = "Too many search requests. Please try again later."

Clock = Callable[[], float]


class InMemoryRateLimiter:
    """Fixed-window counter keyed in this process only."""

    def __init__(self, clock: Clock | None = None) -> None:
        self._clock = clock or monotonic
        self._hits: dict[str, list[float]] = {}

    def allow(self, key: str, max_requests: int, window_seconds: float) -> float | None:
        """
        Record one hit.

        Returns None if allowed, or retry-after seconds if limited.
        """
        if max_requests <= 0:
            return None

        now = self._clock()
        window = max(float(window_seconds), 0.001)
        cutoff = now - window
        recent = [stamp for stamp in self._hits.get(key, []) if stamp > cutoff]
        if len(recent) >= max_requests:
            self._hits[key] = recent
            oldest = recent[0]
            return max(1.0, window - (now - oldest))
        recent.append(now)
        self._hits[key] = recent
        return None

    def reset(self) -> None:
        self._hits.clear()


_limiter = InMemoryRateLimiter()


def get_auth_rate_limiter() -> InMemoryRateLimiter:
    return _limiter


def reset_auth_rate_limiter(limiter: InMemoryRateLimiter | None = None) -> None:
    """Replace the process limiter (tests)."""
    global _limiter
    _limiter = limiter if limiter is not None else InMemoryRateLimiter()


def client_ip_from_request(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host.strip()
    return "unknown"


def normalize_rate_limit_email(email: str | None) -> str:
    return (email or "").strip().lower()


def auth_rate_limit_keys(action: str, client_ip: str, email: str | None) -> tuple[str, ...]:
    """
    IP+endpoint is the primary key so changing email does not reset the budget.

    A second IP+endpoint+email key adds per-account throttling from the same
    client without creating a global account lockout.
    """
    ip = (client_ip or "unknown").strip() or "unknown"
    keys = [f"{action}:ip:{ip}"]
    normalized = normalize_rate_limit_email(email)
    if normalized:
        keys.append(f"{action}:ip:{ip}:email:{normalized}")
    return tuple(keys)


def enforce_auth_rate_limit(action: str, request: Request, email: str | None) -> None:
    settings = get_settings()
    if action == "login":
        max_requests = settings.auth_login_rate_limit
        window_seconds = settings.auth_login_rate_window_seconds
    elif action == "register":
        max_requests = settings.auth_register_rate_limit
        window_seconds = settings.auth_register_rate_window_seconds
    else:
        return

    limiter = get_auth_rate_limiter()
    for key in auth_rate_limit_keys(action, client_ip_from_request(request), email):
        retry_after = limiter.allow(key, max_requests, window_seconds)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=AUTH_RATE_LIMIT_DETAIL,
                headers={"Retry-After": str(int(retry_after))},
            )


def _raise_rate_limited(detail: str, retry_after: float) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=detail,
        headers={"Retry-After": str(int(retry_after))},
    )


def _rate_limit_identity(value: str | None) -> str:
    return (value or "").strip() or "unknown"


def resource_rate_limit_buckets(
    kind: str,
    *,
    user_id: str,
    workspace_id: str,
    user_limit: int,
    workspace_limit: int,
    window_seconds: int,
) -> tuple[tuple[str, int, int], ...]:
    """Workspace quota plus per-user abuse protection.

    Identities must come from trusted server context (current user +
    ``get_current_workspace``), never from the client body, query, or JWT.
    A limit of 0 disables that bucket.
    """
    workspace = _rate_limit_identity(workspace_id)
    user = _rate_limit_identity(user_id)
    return (
        (f"{kind}:workspace:{workspace}", workspace_limit, window_seconds),
        (f"{kind}:user:{user}", user_limit, window_seconds),
    )


def _enforce_resource_rate_limit(
    kind: str,
    *,
    user_id: str,
    workspace_id: str,
    user_limit: int,
    workspace_limit: int,
    window_seconds: int,
    detail: str,
) -> None:
    limiter = get_auth_rate_limiter()
    for key, max_requests, window in resource_rate_limit_buckets(
        kind,
        user_id=user_id,
        workspace_id=workspace_id,
        user_limit=user_limit,
        workspace_limit=workspace_limit,
        window_seconds=window_seconds,
    ):
        retry_after = limiter.allow(key, max_requests, window)
        if retry_after is not None:
            _raise_rate_limited(detail, retry_after)


def enforce_ai_rate_limit(*, user_id: str, workspace_id: str) -> None:
    """Throttle Gemini-backed AI answer and suggest calls.

    Workspace quota protects tenant consumption. User quota prevents one
    member from exhausting the process by themselves.
    """
    settings = get_settings()
    _enforce_resource_rate_limit(
        "ai",
        user_id=user_id,
        workspace_id=workspace_id,
        user_limit=settings.ai_rate_limit,
        workspace_limit=settings.ai_workspace_rate_limit,
        window_seconds=settings.ai_rate_window_seconds,
        detail=AI_RATE_LIMIT_DETAIL,
    )


def enforce_search_rate_limit(*, user_id: str, workspace_id: str) -> None:
    """Throttle knowledge search (embedding retrieval)."""
    settings = get_settings()
    _enforce_resource_rate_limit(
        "search",
        user_id=user_id,
        workspace_id=workspace_id,
        user_limit=settings.search_rate_limit,
        workspace_limit=settings.search_workspace_rate_limit,
        window_seconds=settings.search_rate_window_seconds,
        detail=SEARCH_RATE_LIMIT_DETAIL,
    )
