"""MongoDB connection lifecycle using Motor."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config.settings import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_mongodb() -> AsyncIOMotorDatabase:
    """Create the Motor client and verify connectivity."""
    global _client, _database

    if _database is not None:
        return _database

    settings = get_settings()
    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=3000,
        connectTimeoutMS=3000,
    )
    database = client[settings.mongodb_db_name]

    try:
        # Fail fast if MongoDB is unreachable during startup
        await client.admin.command("ping")
    except Exception:
        client.close()
        raise

    _client = client
    _database = database
    logger.info(
        "Connected to MongoDB database '%s'",
        settings.mongodb_db_name,
    )
    return _database


async def close_mongodb() -> None:
    """Close the Motor client if it exists."""
    global _client, _database

    if _client is not None:
        _client.close()
        logger.info("MongoDB connection closed")

    _client = None
    _database = None


def get_client() -> AsyncIOMotorClient:
    """Return the active Motor client."""
    if _client is None:
        raise RuntimeError(
            "MongoDB client is not initialized. Call connect_mongodb() first."
        )
    return _client


def get_database() -> AsyncIOMotorDatabase:
    """Return the active database handle."""
    if _database is None:
        raise RuntimeError(
            "MongoDB database is not initialized. Call connect_mongodb() first."
        )
    return _database


async def ping_mongodb() -> bool:
    """Return True when the configured MongoDB client answers ping."""
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
        return True
    except Exception:
        return False
