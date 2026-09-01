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
