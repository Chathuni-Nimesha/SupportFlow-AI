"""MongoDB index bootstrap."""

from app.core.logging import get_logger
from app.database.mongodb import get_database
from app.models.conversation import CONVERSATIONS_COLLECTION
from app.models.knowledge import KNOWLEDGE_DOCUMENTS_COLLECTION
from app.models.message import MESSAGES_COLLECTION
from app.models.user import USERS_COLLECTION

logger = get_logger(__name__)


async def ensure_indexes() -> None:
    """Create required indexes for application collections."""
    db = get_database()
    await db[USERS_COLLECTION].create_index("email", unique=True)
    await db[CONVERSATIONS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[CONVERSATIONS_COLLECTION].create_index(
        [("owner_id", 1), ("status", 1)],
    )
    await db[MESSAGES_COLLECTION].create_index(
        [("conversation_id", 1), ("created_at", 1)],
    )
    await db[MESSAGES_COLLECTION].create_index(
        [("owner_id", 1), ("conversation_id", 1)],
    )
    await db[KNOWLEDGE_DOCUMENTS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[KNOWLEDGE_DOCUMENTS_COLLECTION].create_index(
        [("owner_id", 1), ("status", 1)],
    )
    logger.info(
        "Ensured MongoDB indexes for users, conversations, messages, "
        "and knowledge documents",
    )
