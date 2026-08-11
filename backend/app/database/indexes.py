"""MongoDB index bootstrap."""

from app.core.logging import get_logger
from app.database.mongodb import get_database
from app.models.user import USERS_COLLECTION

logger = get_logger(__name__)


async def ensure_indexes() -> None:
    """Create required indexes for application collections."""
    db = get_database()
    await db[USERS_COLLECTION].create_index("email", unique=True)
    logger.info("Ensured unique index on users.email")
