"""Idempotent portfolio demo seed for local development only."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException

from app.config.settings import (
    is_localhost_mongodb_uri,
    is_production_env,
    is_vercel_runtime,
)
from app.core.logging import get_logger
from app.database import indexes as indexes_module
from app.database.mongodb import get_database
from app.demo.catalog import (
    CONVERSATIONS,
    CUSTOMERS,
    KNOWLEDGE_DOCUMENTS,
    RAG_SMOKE_QUERY,
    TEAM_MEMBERS,
    TICKETS,
    catalog_summary,
)
from app.demo.constants import (
    DEFAULT_OWNER_COMPANY,
    DEFAULT_OWNER_EMAIL,
    DEFAULT_OWNER_FIRST_NAME,
    DEFAULT_OWNER_LAST_NAME,
    DEFAULT_OWNER_PASSWORD,
    DEMO_SEED_KEY_FIELD,
    DEMO_SEED_TAG,
)
from app.models.conversation import CONVERSATIONS_COLLECTION
from app.models.customer import CUSTOMERS_COLLECTION
from app.models.knowledge import KNOWLEDGE_DOCUMENTS_COLLECTION
from app.models.message import MESSAGES_COLLECTION
from app.models.team_member import TEAM_MEMBERS_COLLECTION
from app.models.ticket import TICKETS_COLLECTION
from app.models.user import USERS_COLLECTION
from app.models.workspace import WORKSPACES_COLLECTION
from app.schemas.auth import UserRegisterRequest, UserResponse
from app.schemas.conversation import (
    ConversationCreateRequest,
    ConversationMessageCreateRequest,
)
from app.schemas.customer import CustomerCreateRequest
from app.schemas.knowledge import KnowledgeDocumentCreateRequest
from app.schemas.team_member import TeamMemberCreateRequest
from app.schemas.ticket import TicketCreateRequest
from app.services import (
    auth_service,
    conversation_service,
    customer_service,
    knowledge_service,
    team_service,
    ticket_service,
    workspace_service,
)
from app.services.knowledge_retrieval import retrieve_knowledge

logger = get_logger(__name__)

PRODUCTION_SEED_BLOCKED = (
    "Demo seed is blocked when APP_ENV is production. "
    "Use a local development environment only."
)
VERCEL_SEED_BLOCKED = (
    "Demo seed is blocked on Vercel. Run it only against a local development database."
)
REMOTE_MONGO_BLOCKED = (
    "MONGODB_URI does not point at localhost. Refusing to seed unless "
    "--allow-non-localhost is set. Never run this against production Atlas."
)


OWNER_REQUIRED = (
    "Owner account not found. Pass --owner-email for your logged-in development "
    "user, or pass --create-owner-if-missing to register the default demo owner."
)


@dataclass
class CountPair:
    created: int = 0
    skipped: int = 0

    def bump(self, *, created: bool) -> None:
        if created:
            self.created += 1
        else:
            self.skipped += 1


@dataclass
class SeedReport:
    dry_run: bool
    owner_email: str
    owner_user_id: str | None = None
    workspace_id: str | None = None
    workspace_name: str | None = None
    users: CountPair = field(default_factory=CountPair)
    team_members: CountPair = field(default_factory=CountPair)
    customers: CountPair = field(default_factory=CountPair)
    conversations: CountPair = field(default_factory=CountPair)
    messages: CountPair = field(default_factory=CountPair)
    tickets: CountPair = field(default_factory=CountPair)
    knowledge_documents: CountPair = field(default_factory=CountPair)
    knowledge_published: int = 0
    knowledge_indexed: int = 0
    rag_verified: bool = False
    rag_hit_count: int = 0
    kpi_customers: int = 0
    kpi_conversations: int = 0
    kpi_open_tickets: int = 0
    kpi_team_members: int = 0
    kpi_knowledge_published: int = 0
    warnings: list[str] = field(default_factory=list)
    expected: dict[str, Any] = field(default_factory=catalog_summary)


def format_seed_report(report: SeedReport) -> str:
    if report.dry_run:
        lines = [
            "Demo seed dry-run completed.",
            f"Workspace: {report.workspace_name or '(new/unknown)'}",
            f"Owner email: {report.owner_email}",
            f"Customers would create: {report.customers.created} (skip {report.customers.skipped})",
            (
                f"Conversations would create: {report.conversations.created} "
                f"(skip {report.conversations.skipped})"
            ),
            f"Tickets would create: {report.tickets.created} (skip {report.tickets.skipped})",
            (
                f"Knowledge documents would create: "
                f"{report.knowledge_documents.created} "
                f"(skip {report.knowledge_documents.skipped})"
            ),
            (
                f"Team members would create: {report.team_members.created} "
                f"(skip {report.team_members.skipped})"
            ),
        ]
    else:
        lines = [
            "Demo seed completed successfully.",
            f"Workspace: {report.workspace_name or '-'}",
            f"Customers created: {report.customers.created} (skipped: {report.customers.skipped})",
            (
                f"Conversations created: {report.conversations.created} "
                f"(skipped: {report.conversations.skipped})"
            ),
            f"Tickets created: {report.tickets.created} (skipped: {report.tickets.skipped})",
            (
                f"Knowledge documents created: {report.knowledge_documents.created} "
                f"(skipped: {report.knowledge_documents.skipped})"
            ),
            f"Knowledge documents published: {report.knowledge_published}",
            f"Knowledge documents indexed: {report.knowledge_indexed}",
            (
                f"Team members created: {report.team_members.created} "
                f"(skipped: {report.team_members.skipped})"
            ),
            (
                f"Dashboard KPIs - customers={report.kpi_customers}, "
                f"conversations={report.kpi_conversations}, "
                f"open_tickets={report.kpi_open_tickets}, "
                f"team={report.kpi_team_members}, "
                f"published_knowledge={report.kpi_knowledge_published}"
            ),
            f"RAG verified: {report.rag_verified} (hits={report.rag_hit_count})",
        ]
    for warning in report.warnings:
        lines.append(f"warning: {warning}")
    return "\n".join(lines) + "\n"


def _assert_safe_to_seed(*, allow_non_localhost: bool) -> None:
    # Read APP_ENV / URI from the process environment so production policy
    # validation (non-localhost Mongo, JWT, etc.) does not run before our guard.
    app_env = (os.getenv("APP_ENV") or "development").strip()
    if is_production_env(app_env):
        raise RuntimeError(PRODUCTION_SEED_BLOCKED)
    if is_vercel_runtime():
        raise RuntimeError(VERCEL_SEED_BLOCKED)
    mongodb_uri = (
        (os.getenv("MONGODB_URI") or "").strip()
        or (os.getenv("MONGODB_URL") or "").strip()
        or "mongodb://localhost:27017"
    )
    if not is_localhost_mongodb_uri(mongodb_uri) and not allow_non_localhost:
        raise RuntimeError(REMOTE_MONGO_BLOCKED)


def _owner_password(explicit: str | None) -> str:
    if explicit:
        return explicit
    from_env = (os.getenv("SUPPORTFLOW_DEMO_OWNER_PASSWORD") or "").strip()
    if from_env:
        return from_env
    return DEFAULT_OWNER_PASSWORD


async def _load_user_by_email(email: str) -> dict[str, Any] | None:
    db = get_database()
    return await db[USERS_COLLECTION].find_one({"email": email.strip().lower()})


async def _resolve_owner_workspace(
    user_doc: dict[str, Any],
) -> tuple[UserResponse, str]:
    user = await workspace_service.build_user_response(user_doc)
    workspace_id = (user.default_workspace_id or "").strip()
    if not workspace_id:
        personal = await get_database()[WORKSPACES_COLLECTION].find_one(
            {"owner_user_id": str(user_doc["_id"])},
        )
        if personal is None:
            raise RuntimeError(
                "Owner has no personal workspace. Register normally once, "
                "or re-run after workspace provisioning succeeds."
            )
        workspace_id = str(personal["_id"])
    return user, workspace_id


async def _attach_workspace_name(report: SeedReport, workspace_id: str | None) -> None:
    if not workspace_id:
        return
    workspace = await get_database()[WORKSPACES_COLLECTION].find_one(
        {"_id": workspace_id},
    )
    if workspace is not None:
        report.workspace_name = str(workspace.get("name") or "")


async def _ensure_owner(
    *,
    owner_email: str,
    owner_password: str,
    dry_run: bool,
    create_owner_if_missing: bool,
    report: SeedReport,
) -> tuple[UserResponse | None, str | None]:
    existing = await _load_user_by_email(owner_email)
    if existing is not None:
        report.users.bump(created=False)
        if dry_run:
            report.owner_user_id = str(existing["_id"])
            workspace = await get_database()[WORKSPACES_COLLECTION].find_one(
                {"owner_user_id": str(existing["_id"])},
            )
            report.workspace_id = (
                str(workspace["_id"])
                if workspace
                else existing.get("default_workspace_id")
            )
            await _attach_workspace_name(report, report.workspace_id)
            return None, report.workspace_id
        user, workspace_id = await _resolve_owner_workspace(existing)
        report.owner_user_id = user.id
        report.workspace_id = workspace_id
        await _attach_workspace_name(report, workspace_id)
        return user, workspace_id

    if not create_owner_if_missing:
        raise RuntimeError(OWNER_REQUIRED)

    report.users.bump(created=True)
    if dry_run:
        return None, None

    await auth_service.register_user(
        UserRegisterRequest(
            first_name=DEFAULT_OWNER_FIRST_NAME,
            last_name=DEFAULT_OWNER_LAST_NAME,
            company_name=DEFAULT_OWNER_COMPANY,
            email=owner_email,
            password=owner_password,
        ),
    )
    refreshed = await _load_user_by_email(owner_email)
    if refreshed is None:
        raise RuntimeError("Owner registration succeeded but user lookup failed.")
    user, workspace_id = await _resolve_owner_workspace(refreshed)
    report.owner_user_id = user.id
    report.workspace_id = workspace_id
    await _attach_workspace_name(report, workspace_id)
    return user, workspace_id


async def _find_member(workspace_id: str, email: str) -> dict[str, Any] | None:
    return await get_database()[TEAM_MEMBERS_COLLECTION].find_one(
        {"workspace_id": workspace_id, "email": email.strip().lower()},
    )


async def _ensure_team(
    *,
    current_user: UserResponse | None,
    workspace_id: str | None,
    dry_run: bool,
    report: SeedReport,
) -> dict[str, str]:
    """Return map of catalog team key -> member id (includes owner as 'owner')."""
    member_ids: dict[str, str] = {}
    if workspace_id and not dry_run and current_user is not None:
        owner_member = await _find_member(workspace_id, str(current_user.email))
        if owner_member is not None:
            member_ids["owner"] = str(owner_member["_id"])
        else:
            member_ids["owner"] = current_user.id

    for spec in TEAM_MEMBERS:
        if dry_run:
            if workspace_id:
                existing = await _find_member(workspace_id, spec["email"])
                report.team_members.bump(created=existing is None)
            else:
                report.team_members.bump(created=True)
            continue

        assert current_user is not None and workspace_id is not None
        existing = await _find_member(workspace_id, spec["email"])
        if existing is not None:
            report.team_members.bump(created=False)
            member_ids[spec["key"]] = str(existing["_id"])
            continue

        created = await team_service.create_team_member(
            current_user,
            workspace_id,
            TeamMemberCreateRequest(
                first_name=spec["first_name"],
                last_name=spec["last_name"],
                email=spec["email"],
                role=spec["role"],  # type: ignore[arg-type]
                status="ACTIVE",
            ),
        )
        report.team_members.bump(created=True)
        member_ids[spec["key"]] = created.id
        await get_database()[TEAM_MEMBERS_COLLECTION].update_one(
            {"_id": created.id},
            {"$set": {DEMO_SEED_KEY_FIELD: spec["key"]}},
        )

    return member_ids


async def _find_customer(workspace_id: str, email: str) -> dict[str, Any] | None:
    return await get_database()[CUSTOMERS_COLLECTION].find_one(
        {"workspace_id": workspace_id, "email": email.strip().lower()},
    )


async def _ensure_customers(
    *,
    owner_id: str | None,
    workspace_id: str | None,
    dry_run: bool,
    report: SeedReport,
) -> dict[str, dict[str, Any]]:
    customers: dict[str, dict[str, Any]] = {}
    for spec in CUSTOMERS:
        if dry_run:
            if workspace_id:
                existing = await _find_customer(workspace_id, spec["email"])
                report.customers.bump(created=existing is None)
            else:
                report.customers.bump(created=True)
            continue

        assert owner_id is not None and workspace_id is not None
        existing = await _find_customer(workspace_id, spec["email"])
        if existing is not None:
            report.customers.bump(created=False)
            customers[spec["key"]] = existing
            continue

        created = await customer_service.create_customer(
            workspace_id=workspace_id,
            owner_id=owner_id,
            payload=CustomerCreateRequest(
                first_name=spec["first_name"],
                last_name=spec["last_name"],
                email=spec["email"],
                phone=spec["phone"],
                company=spec["company"],
                notes=spec["notes"],
            ),
        )
        report.customers.bump(created=True)
        await get_database()[CUSTOMERS_COLLECTION].update_one(
            {"_id": created.id},
            {"$set": {DEMO_SEED_KEY_FIELD: spec["key"]}},
        )
        document = await get_database()[CUSTOMERS_COLLECTION].find_one(
            {"_id": created.id},
        )
        customers[spec["key"]] = document or {
            "_id": created.id,
            "first_name": created.first_name,
            "last_name": created.last_name,
            "email": str(created.email),
        }
    return customers


async def _find_by_seed_key(
    collection: str,
    workspace_id: str,
    seed_key: str,
) -> dict[str, Any] | None:
    return await get_database()[collection].find_one(
        {"workspace_id": workspace_id, DEMO_SEED_KEY_FIELD: seed_key},
    )


async def _ensure_conversations_and_messages(
    *,
    owner_id: str | None,
    workspace_id: str | None,
    customers: dict[str, dict[str, Any]],
    member_ids: dict[str, str],
    dry_run: bool,
    report: SeedReport,
) -> dict[str, str]:
    conversation_ids: dict[str, str] = {}
    for index, spec in enumerate(CONVERSATIONS):
        if dry_run:
            if workspace_id:
                existing = await _find_by_seed_key(
                    CONVERSATIONS_COLLECTION,
                    workspace_id,
                    spec["key"],
                )
                created = existing is None
            else:
                created = True
            report.conversations.bump(created=created)
            if created:
                report.messages.created += len(spec["messages"])
            else:
                report.messages.skipped += len(spec["messages"])
            continue

        assert owner_id is not None and workspace_id is not None
        existing = await _find_by_seed_key(
            CONVERSATIONS_COLLECTION,
            workspace_id,
            spec["key"],
        )
        if existing is not None:
            report.conversations.bump(created=False)
            report.messages.skipped += len(spec["messages"])
            conversation_ids[spec["key"]] = str(existing["_id"])
            continue

        customer = customers[spec["customer_key"]]
        customer_name = f"{customer['first_name']} {customer['last_name']}"
        assigned_agent_id = None
        if spec["assigned_agent_key"]:
            assigned_agent_id = member_ids.get(spec["assigned_agent_key"])

        messages = spec["messages"]
        initial = messages[0]["content"] if messages else None
        created = await conversation_service.create_conversation(
            workspace_id=workspace_id,
            owner_id=owner_id,
            payload=ConversationCreateRequest(
                customer_name=customer_name,
                customer_email=str(customer["email"]),
                subject=spec["subject"],
                channel=spec["channel"],  # type: ignore[arg-type]
                status=spec["status"],  # type: ignore[arg-type]
                assigned_agent_id=assigned_agent_id,
                customer_id=str(customer["_id"]),
                unread_count=spec["unread_count"],
                initial_message=initial,
            ),
        )
        report.conversations.bump(created=True)
        if initial:
            report.messages.created += 1
        conversation_ids[spec["key"]] = created.id

        for message in messages[1:]:
            sender_name = message["sender_name"]
            if message["sender_type"] == "agent" and not sender_name:
                sender_name = "Support Agent"
            await conversation_service.add_message(
                created.id,
                workspace_id,
                ConversationMessageCreateRequest(
                    content=message["content"],
                    sender_type=message["sender_type"],  # type: ignore[arg-type]
                    sender_name=sender_name,
                ),
                owner_id=owner_id,
            )
            report.messages.created += 1

        created_at = datetime.now(UTC) - timedelta(days=10 - index, hours=index)
        await get_database()[CONVERSATIONS_COLLECTION].update_one(
            {"_id": created.id},
            {
                "$set": {
                    DEMO_SEED_KEY_FIELD: spec["key"],
                    "created_at": created_at,
                    "updated_at": created_at + timedelta(hours=2 + index),
                },
            },
        )
        await get_database()[MESSAGES_COLLECTION].update_many(
            {"conversation_id": created.id},
            {"$set": {DEMO_SEED_KEY_FIELD: spec["key"]}},
        )
    return conversation_ids


async def _ensure_tickets(
    *,
    owner_id: str | None,
    workspace_id: str | None,
    customers: dict[str, dict[str, Any]],
    conversation_ids: dict[str, str],
    member_ids: dict[str, str],
    dry_run: bool,
    report: SeedReport,
) -> None:
    for spec in TICKETS:
        if dry_run:
            if workspace_id:
                existing = await _find_by_seed_key(
                    TICKETS_COLLECTION,
                    workspace_id,
                    spec["key"],
                )
                report.tickets.bump(created=existing is None)
            else:
                report.tickets.bump(created=True)
            continue

        assert owner_id is not None and workspace_id is not None
        existing = await _find_by_seed_key(
            TICKETS_COLLECTION,
            workspace_id,
            spec["key"],
        )
        if existing is not None:
            report.tickets.bump(created=False)
            continue

        customer = customers[spec["customer_key"]]
        conversation_id = None
        if spec["conversation_key"]:
            conversation_id = conversation_ids.get(spec["conversation_key"])
        assignee_id = None
        if spec["assignee_key"]:
            assignee_id = member_ids.get(spec["assignee_key"])

        created = await ticket_service.create_ticket(
            workspace_id=workspace_id,
            owner_id=owner_id,
            payload=TicketCreateRequest(
                customer_id=str(customer["_id"]),
                title=spec["title"],
                description=spec["description"],
                status=spec["status"],  # type: ignore[arg-type]
                priority=spec["priority"],  # type: ignore[arg-type]
                assignee_id=assignee_id,
                conversation_id=conversation_id,
                resolution_note=spec["resolution_note"],
            ),
        )
        report.tickets.bump(created=True)
        await get_database()[TICKETS_COLLECTION].update_one(
            {"_id": created.id},
            {"$set": {DEMO_SEED_KEY_FIELD: spec["key"]}},
        )


async def _ensure_knowledge(
    *,
    owner_id: str | None,
    workspace_id: str | None,
    dry_run: bool,
    report: SeedReport,
) -> None:
    for spec in KNOWLEDGE_DOCUMENTS:
        if dry_run:
            if workspace_id:
                existing = await get_database()[KNOWLEDGE_DOCUMENTS_COLLECTION].find_one(
                    {
                        "workspace_id": workspace_id,
                        "title": spec["title"],
                        "tags": DEMO_SEED_TAG,
                    },
                )
                report.knowledge_documents.bump(created=existing is None)
                if existing and existing.get("ingestion_status") == "indexed":
                    report.knowledge_indexed += 1
            else:
                report.knowledge_documents.bump(created=True)
            continue

        assert owner_id is not None and workspace_id is not None
        existing = await get_database()[KNOWLEDGE_DOCUMENTS_COLLECTION].find_one(
            {
                "workspace_id": workspace_id,
                "title": spec["title"],
                "tags": DEMO_SEED_TAG,
            },
        )
        if existing is not None:
            report.knowledge_documents.bump(created=False)
            if existing.get("status") == "Published":
                report.knowledge_published += 1
            if existing.get("ingestion_status") == "indexed":
                report.knowledge_indexed += 1
            elif existing.get("status") == "Published":
                # Retry real ingestion for previously saved-but-not-indexed docs
                # (e.g. Chroma was down on the first seed run).
                try:
                    refreshed = await knowledge_service.ingest_knowledge_document(
                        str(existing["_id"]),
                        workspace_id,
                    )
                    if refreshed.ingestion_status == "indexed":
                        report.knowledge_indexed += 1
                    else:
                        report.warnings.append(
                            f"Knowledge '{existing.get('title')}' ingestion "
                            f"status={refreshed.ingestion_status}"
                            + (
                                f": {refreshed.ingestion_error}"
                                if refreshed.ingestion_error
                                else ""
                            ),
                        )
                except Exception as exc:  # noqa: BLE001
                    report.warnings.append(
                        f"Knowledge re-ingest failed ({type(exc).__name__})",
                    )
            continue

        created = await knowledge_service.create_knowledge_document(
            workspace_id=workspace_id,
            owner_id=owner_id,
            payload=KnowledgeDocumentCreateRequest(
                title=spec["title"],
                content=spec["content"],
                source_type="manual",
                status="Published",
                tags=spec["tags"],
            ),
        )
        report.knowledge_documents.bump(created=True)
        if created.status == "Published":
            report.knowledge_published += 1
        await get_database()[KNOWLEDGE_DOCUMENTS_COLLECTION].update_one(
            {"_id": created.id},
            {"$set": {DEMO_SEED_KEY_FIELD: spec["key"]}},
        )
        if created.ingestion_status == "indexed":
            report.knowledge_indexed += 1
        elif created.ingestion_status == "failed":
            report.warnings.append(
                f"Knowledge '{created.title}' ingestion failed: "
                f"{created.ingestion_error or 'unknown error'}",
            )


async def _verify_rag(workspace_id: str | None, report: SeedReport) -> None:
    if not workspace_id:
        return
    try:
        hits = await retrieve_knowledge(
            workspace_id,
            RAG_SMOKE_QUERY,
            top_k=3,
        )
    except Exception as exc:  # noqa: BLE001 - seed should keep going
        report.warnings.append(f"RAG verification failed: {type(exc).__name__}")
        return
    report.rag_hit_count = len(hits)
    report.rag_verified = len(hits) > 0
    if not report.rag_verified:
        report.warnings.append(
            "RAG verification returned no hits. Ensure Chroma is running "
            "(local VECTOR_STORE=chroma) or re-run after fixing ingestion warnings.",
        )


async def _collect_kpis(workspace_id: str | None, report: SeedReport) -> None:
    if not workspace_id:
        return
    db = get_database()
    report.kpi_customers = await db[CUSTOMERS_COLLECTION].count_documents(
        {"workspace_id": workspace_id},
    )
    report.kpi_conversations = await db[CONVERSATIONS_COLLECTION].count_documents(
        {"workspace_id": workspace_id},
    )
    report.kpi_open_tickets = await db[TICKETS_COLLECTION].count_documents(
        {"workspace_id": workspace_id, "status": "OPEN"},
    )
    report.kpi_team_members = await db[TEAM_MEMBERS_COLLECTION].count_documents(
        {"workspace_id": workspace_id},
    )
    report.kpi_knowledge_published = await db[KNOWLEDGE_DOCUMENTS_COLLECTION].count_documents(
        {"workspace_id": workspace_id, "status": "Published"},
    )


async def run_portfolio_seed(
    *,
    owner_email: str = DEFAULT_OWNER_EMAIL,
    owner_password: str | None = None,
    dry_run: bool = False,
    allow_non_localhost: bool = False,
    skip_rag_check: bool = False,
    create_owner_if_missing: bool = False,
) -> SeedReport:
    """
    Seed realistic portfolio demo data into one local workspace.

    Idempotent: re-running skips records already present (by email or
    ``demo_seed_key`` / title+tag for knowledge). Does not delete or
    overwrite existing non-demo records.
    """
    _assert_safe_to_seed(allow_non_localhost=allow_non_localhost)
    password = _owner_password(owner_password)
    report = SeedReport(
        dry_run=dry_run,
        owner_email=owner_email.strip().lower(),
    )

    if not dry_run:
        await indexes_module.ensure_indexes()

    try:
        user, workspace_id = await _ensure_owner(
            owner_email=report.owner_email,
            owner_password=password,
            dry_run=dry_run,
            create_owner_if_missing=create_owner_if_missing,
            report=report,
        )
    except HTTPException as exc:
        raise RuntimeError(f"Owner setup failed: {exc.detail}") from exc

    owner_id = report.owner_user_id
    member_ids = await _ensure_team(
        current_user=user,
        workspace_id=workspace_id,
        dry_run=dry_run,
        report=report,
    )
    customers = await _ensure_customers(
        owner_id=owner_id,
        workspace_id=workspace_id,
        dry_run=dry_run,
        report=report,
    )
    conversation_ids = await _ensure_conversations_and_messages(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customers=customers,
        member_ids=member_ids,
        dry_run=dry_run,
        report=report,
    )
    await _ensure_tickets(
        owner_id=owner_id,
        workspace_id=workspace_id,
        customers=customers,
        conversation_ids=conversation_ids,
        member_ids=member_ids,
        dry_run=dry_run,
        report=report,
    )
    await _ensure_knowledge(
        owner_id=owner_id,
        workspace_id=workspace_id,
        dry_run=dry_run,
        report=report,
    )
    if not dry_run:
        await _collect_kpis(workspace_id, report)
        if not skip_rag_check:
            await _verify_rag(workspace_id, report)
    return report
