"""Phase 1B additive workspace backfill.

Creates one personal workspace per existing user and stamps ``workspace_id``
onto owner-scoped documents that do not already have one.

Does not change ``owner_id``, user ids, assignee ids, or runtime behavior.
Does not migrate Chroma.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pymongo.errors import DuplicateKeyError

from app.models.conversation import CONVERSATIONS_COLLECTION
from app.models.customer import CUSTOMERS_COLLECTION
from app.models.knowledge import KNOWLEDGE_DOCUMENTS_COLLECTION
from app.models.message import MESSAGES_COLLECTION
from app.models.team_member import TEAM_MEMBERS_COLLECTION
from app.models.ticket import TICKETS_COLLECTION
from app.models.user import USERS_COLLECTION
from app.models.workspace import WORKSPACES_COLLECTION, build_workspace_document, personal_workspace_name

RESOURCE_COLLECTIONS: tuple[str, ...] = (
    CONVERSATIONS_COLLECTION,
    MESSAGES_COLLECTION,
    CUSTOMERS_COLLECTION,
    TICKETS_COLLECTION,
    TEAM_MEMBERS_COLLECTION,
    KNOWLEDGE_DOCUMENTS_COLLECTION,
)

_RESOURCE_LABELS: tuple[str, ...] = (
    "conversations",
    "messages",
    "customers",
    "tickets",
    "team_members",
    "knowledge_documents",
)


def missing_workspace_filter(owner_id: str) -> dict[str, Any]:
    """Match owner-scoped docs that do not already have a workspace_id."""
    return {
        "owner_id": owner_id,
        "$or": [
            {"workspace_id": {"$exists": False}},
            {"workspace_id": None},
            {"workspace_id": ""},
        ],
    }


# Re-exported for existing Phase 1B tests and CLI callers.


@dataclass
class UserBackfillStats:
    user_id: str
    email: str
    workspace_id: str | None
    workspace_name: str
    workspace_created: int
    workspace_reused: int
    conversations: int = 0
    messages: int = 0
    customers: int = 0
    tickets: int = 0
    team_members: int = 0
    knowledge_documents: int = 0

    def resource_counts(self) -> dict[str, int]:
        return {
            "conversations": self.conversations,
            "messages": self.messages,
            "customers": self.customers,
            "tickets": self.tickets,
            "team_members": self.team_members,
            "knowledge_documents": self.knowledge_documents,
        }


@dataclass
class BackfillReport:
    dry_run: bool
    users: list[UserBackfillStats] = field(default_factory=list)

    @property
    def totals(self) -> dict[str, int]:
        counts = {
            "users": len(self.users),
            "workspace": 0,
            "conversations": 0,
            "messages": 0,
            "customers": 0,
            "tickets": 0,
            "team_members": 0,
            "knowledge_documents": 0,
        }
        for user in self.users:
            counts["workspace"] += user.workspace_created
            for label, value in user.resource_counts().items():
                counts[label] += value
        return counts


def format_backfill_report(report: BackfillReport) -> str:
    mode = (
        "DRY RUN (zero writes)"
        if report.dry_run
        else "WRITE (additive workspace_id backfill)"
    )
    lines = [
        "Phase 1B workspace backfill",
        f"Mode: {mode}",
        "",
    ]
    if not report.users:
        lines.append("No users found.")
        lines.append("")
        return "\n".join(lines)

    for stats in report.users:
        email = stats.email or "(no email)"
        lines.append(f"User {stats.user_id} ({email})")
        if stats.workspace_created:
            action = f'create, name="{stats.workspace_name}"'
        else:
            action = (
                f'reuse, id={stats.workspace_id}, name="{stats.workspace_name}"'
            )
        lines.append(f"  workspace:             {stats.workspace_created}  ({action})")
        for label in _RESOURCE_LABELS:
            count = stats.resource_counts()[label]
            lines.append(f"  {label + ':':<22} {count}")
        lines.append("")

    totals = report.totals
    lines.append("Totals")
    lines.append(f"  users:                 {totals['users']}")
    lines.append(f"  workspace:             {totals['workspace']}")
    for label in _RESOURCE_LABELS:
        lines.append(f"  {label + ':':<22} {totals[label]}")
    lines.append("")
    return "\n".join(lines)


async def _count_missing(collection: Any, owner_id: str) -> int:
    return await collection.count_documents(missing_workspace_filter(owner_id))


async def _set_missing_workspace_id(
    collection: Any,
    owner_id: str,
    workspace_id: str,
    *,
    dry_run: bool,
) -> int:
    filters = missing_workspace_filter(owner_id)
    if dry_run:
        return await collection.count_documents(filters)
    result = await collection.update_many(
        filters,
        {"$set": {"workspace_id": workspace_id}},
    )
    return int(result.modified_count)


async def _resolve_workspace(
    workspaces: Any,
    user: dict[str, Any],
    *,
    dry_run: bool,
) -> tuple[str | None, str, int, int]:
    user_id = str(user["_id"])
    name = personal_workspace_name(user)
    existing = await workspaces.find_one({"owner_user_id": user_id})
    if existing is not None:
        return (
            str(existing["_id"]),
            str(existing.get("name") or name),
            0,
            1,
        )

    if dry_run:
        return None, name, 1, 0

    document = build_workspace_document(name=name, owner_user_id=user_id)
    try:
        await workspaces.insert_one(document)
        return str(document["_id"]), name, 1, 0
    except DuplicateKeyError:
        reused = await workspaces.find_one({"owner_user_id": user_id})
        if reused is None:
            raise
        return str(reused["_id"]), str(reused.get("name") or name), 0, 1


async def run_workspace_backfill(
    database: Any,
    *,
    dry_run: bool = False,
) -> BackfillReport:
    """Backfill personal workspaces. Dry run performs no writes."""
    report = BackfillReport(dry_run=dry_run)
    users = database[USERS_COLLECTION]
    workspaces = database[WORKSPACES_COLLECTION]
    collections = {
        "conversations": database[CONVERSATIONS_COLLECTION],
        "messages": database[MESSAGES_COLLECTION],
        "customers": database[CUSTOMERS_COLLECTION],
        "tickets": database[TICKETS_COLLECTION],
        "team_members": database[TEAM_MEMBERS_COLLECTION],
        "knowledge_documents": database[KNOWLEDGE_DOCUMENTS_COLLECTION],
    }

    cursor = users.find({})
    async for user in cursor:
        user_id = str(user["_id"])
        workspace_id, workspace_name, created, reused = await _resolve_workspace(
            workspaces,
            user,
            dry_run=dry_run,
        )

        resource_counts: dict[str, int] = {}
        for label, collection in collections.items():
            if dry_run or workspace_id is None:
                resource_counts[label] = await _count_missing(collection, user_id)
            else:
                resource_counts[label] = await _set_missing_workspace_id(
                    collection,
                    user_id,
                    workspace_id,
                    dry_run=False,
                )

        report.users.append(
            UserBackfillStats(
                user_id=user_id,
                email=str(user.get("email") or ""),
                workspace_id=workspace_id,
                workspace_name=workspace_name,
                workspace_created=created,
                workspace_reused=reused,
                **resource_counts,
            ),
        )

    return report
