"""Vercel backend project config: FastAPI app in main.py, no SPA rewrite."""

import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.routing import APIRoute

from main import app

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_VERCEL_JSON = _BACKEND_ROOT / "vercel.json"


def _load_vercel_json() -> dict:
    return json.loads(_VERCEL_JSON.read_text(encoding="utf-8"))


def _openapi_paths() -> set[str]:
    return set((app.openapi().get("paths") or {}).keys())


def test_vercel_json_targets_main_py() -> None:
    config = _load_vercel_json()
    functions = config.get("functions") or {}
    assert "main.py" in functions
    assert functions["main.py"]["maxDuration"] == 60


def test_backend_vercel_json_has_no_spa_rewrite() -> None:
    config = _load_vercel_json()
    rewrites = config.get("rewrites") or []
    destinations = [
        str(rule.get("destination") or "")
        for rule in rewrites
        if isinstance(rule, dict)
    ]
    assert "rewrites" not in config or rewrites == []
    assert all("index.html" not in dest for dest in destinations)


def test_main_exports_fastapi_app() -> None:
    assert isinstance(app, FastAPI)
    assert any(
        isinstance(route, APIRoute) and route.path == "/health"
        for route in app.routes
    )


def test_app_exposes_api_v1_and_health() -> None:
    paths = _openapi_paths()
    assert "/health" in paths
    api_paths = {path for path in paths if path.startswith("/api/v1")}
    assert api_paths
    assert any(path.startswith("/api/v1/auth") for path in api_paths)
    assert any(path.startswith("/api/v1/knowledge") for path in api_paths)
    assert any(path.startswith("/api/v1/ai") for path in api_paths)
