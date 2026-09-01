"""MongoDB index bootstrap."""

from app.core.logging import get_logger
from app.database.mongodb import get_database
from app.models.conversation import CONVERSATIONS_COLLECTION
from app.models.customer import CUSTOMERS_COLLECTION
from app.models.knowledge import KNOWLEDGE_DOCUMENTS_COLLECTION
from app.models.message import MESSAGES_COLLECTION
from app.models.ticket import TICKETS_COLLECTION
from app.models.team_member import TEAM_MEMBERS_COLLECTION
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
    await db[CUSTOMERS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[CUSTOMERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    await db[TICKETS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("owner_id", 1), ("status", 1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("owner_id", 1), ("priority", 1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("owner_id", 1), ("assignee_id", 1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("owner_id", 1), ("customer_id", 1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("role", 1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("status", 1)],
    )
    logger.info(
        "Ensured MongoDB indexes for users, conversations, messages, "
        "knowledge documents, customers, tickets, and team members",
    )
