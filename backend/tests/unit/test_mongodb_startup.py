"""MongoDB startup fail-closed behavior."""

import pytest

from main import PRODUCTION_MONGODB_STARTUP_ERROR, initialize_mongodb


@pytest.mark.asyncio
async def test_development_startup_tolerates_mongodb_failure(monkeypatch) -> None:
    async def _fail_connect():
        raise ConnectionError("simulated mongodb outage")

    monkeypatch.setattr("main.connect_mongodb", _fail_connect)
    await initialize_mongodb(fail_closed=False)


@pytest.mark.asyncio
async def test_production_startup_fails_closed_on_mongodb_failure(monkeypatch) -> None:
    async def _fail_connect():
        raise ConnectionError("mongodb://user:secret@localhost:27017")

    monkeypatch.setattr("main.connect_mongodb", _fail_connect)
    with pytest.raises(RuntimeError) as exc_info:
        await initialize_mongodb(fail_closed=True)
    message = str(exc_info.value)
    assert message == PRODUCTION_MONGODB_STARTUP_ERROR
    assert "mongodb://" not in message
    assert "secret" not in message
