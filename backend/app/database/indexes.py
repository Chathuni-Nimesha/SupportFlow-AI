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
from app.models.workspace import WORKSPACES_COLLECTION

logger = get_logger(__name__)


async def ensure_indexes() -> None:
    """Create required indexes for application collections."""
    db = get_database()
    await db[USERS_COLLECTION].create_index("email", unique=True)
    # Phase 1A: one personal workspace per user. Drop/replace this unique
    # constraint before allowing a user to own multiple workspaces.
    await db[WORKSPACES_COLLECTION].create_index("owner_user_id", unique=True)
    await db[CONVERSATIONS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[CONVERSATIONS_COLLECTION].create_index(
        [("owner_id", 1), ("status", 1)],
    )
    # Phase 1D-3: conversation tenancy is workspace_id. Keep owner_id indexes
    # so already-backfilled databases stay valid until a later drop.
    await db[CONVERSATIONS_COLLECTION].create_index(
        [("workspace_id", 1), ("updated_at", -1)],
    )
    await db[CONVERSATIONS_COLLECTION].create_index(
        [("workspace_id", 1), ("status", 1)],
    )
    await db[MESSAGES_COLLECTION].create_index(
        [("conversation_id", 1), ("created_at", 1)],
    )
    await db[MESSAGES_COLLECTION].create_index(
        [("owner_id", 1), ("conversation_id", 1)],
    )
    # Messages are loaded after a parent conversation workspace check.
    # There is no messages.workspace_id query path; keep the owner index until
    # a later drop.
    await db[KNOWLEDGE_DOCUMENTS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[KNOWLEDGE_DOCUMENTS_COLLECTION].create_index(
        [("owner_id", 1), ("status", 1)],
    )
    # Phase 1D-4: knowledge tenancy is workspace_id. Keep owner_id indexes
    # so already-backfilled databases stay valid until a later drop.
    await db[KNOWLEDGE_DOCUMENTS_COLLECTION].create_index(
        [("workspace_id", 1), ("updated_at", -1)],
    )
    await db[KNOWLEDGE_DOCUMENTS_COLLECTION].create_index(
        [("workspace_id", 1), ("status", 1)],
    )
    await db[CUSTOMERS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[CUSTOMERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    # Phase 1D-1: customer tenancy is workspace_id. Keep the owner_id unique
    # index so already-backfilled databases stay valid until a later drop.
    # Temporary: unique (owner_id, email) can block the same creator from
    # storing the same email in two workspaces. Do not drop yet.
    await db[CUSTOMERS_COLLECTION].create_index(
        [("workspace_id", 1), ("updated_at", -1)],
    )
    await db[CUSTOMERS_COLLECTION].create_index(
        [("workspace_id", 1), ("email", 1)],
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
    # Phase 1D-2: ticket tenancy is workspace_id. Keep owner_id indexes
    # so already-backfilled databases stay valid until a later drop.
    await db[TICKETS_COLLECTION].create_index(
        [("workspace_id", 1), ("updated_at", -1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("workspace_id", 1), ("status", 1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("workspace_id", 1), ("priority", 1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("workspace_id", 1), ("assignee_id", 1)],
    )
    await db[TICKETS_COLLECTION].create_index(
        [("workspace_id", 1), ("customer_id", 1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("updated_at", -1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("email", 1)],
        unique=True,
    )
    # Temporary: unique (owner_id, email) is retained for compatibility.
    # Membership uniqueness for current tenancy is (workspace_id, email) and
    # (workspace_id, user_id). Do not drop the owner unique index yet.
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("role", 1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("owner_id", 1), ("status", 1)],
    )
    # Phase 1D-5: team membership tenancy is workspace_id. Keep owner_id
    # indexes so already-backfilled databases stay valid until a later drop.
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("workspace_id", 1), ("updated_at", -1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("workspace_id", 1), ("email", 1)],
        unique=True,
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("workspace_id", 1), ("role", 1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("workspace_id", 1), ("status", 1)],
    )
    await db[TEAM_MEMBERS_COLLECTION].create_index(
        [("workspace_id", 1), ("user_id", 1)],
        unique=True,
        partialFilterExpression={"user_id": {"$type": "string"}},
    )
    logger.info(
        "Ensured MongoDB indexes for users, workspaces, conversations, "
        "messages, knowledge documents, customers, tickets, and team members",
    )
