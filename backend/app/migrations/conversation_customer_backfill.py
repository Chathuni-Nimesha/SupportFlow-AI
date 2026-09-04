"""Phase 2B additive conversation.customer_id backfill.

Links unlinked conversations to a customer when there is exactly one
match on ``(workspace_id, email)``. Does not infer workspace from
``owner_id``. Does not create customers. Does not rewrite name/email.
Does not run on startup.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.conversation import CONVERSATIONS_COLLECTION
from app.models.customer import CUSTOMERS_COLLECTION


def unlinked_customer_id_filter() -> dict[str, Any]:
    """Match conversations whose customer_id is missing, null, or blank."""
    return {
        "$or": [
            {"customer_id": {"$exists": False}},
            {"customer_id": None},
            {"customer_id": ""},
        ],
    }


@dataclass
class ConversationCustomerBackfillReport:
    dry_run: bool
    scanned: int = 0
    linked: int = 0
    skipped_no_match: int = 0
    skipped_ambiguous: int = 0
    skipped_already_linked: int = 0
    skipped_invalid: int = 0
    linked_ids: list[str] = field(default_factory=list)

    def resource_counts(self) -> dict[str, int]:
        return {
            "scanned": self.scanned,
            "linked": self.linked,
            "skipped_no_match": self.skipped_no_match,
            "skipped_ambiguous": self.skipped_ambiguous,
            "skipped_already_linked": self.skipped_already_linked,
            "skipped_invalid": self.skipped_invalid,
        }


def format_conversation_customer_backfill_report(
    report: ConversationCustomerBackfillReport,
) -> str:
    mode = (
        "DRY RUN (zero writes)"
        if report.dry_run
        else "WRITE (additive conversation.customer_id backfill)"
    )
    lines = [
        "Phase 2B conversation customer_id backfill",
        f"Mode: {mode}",
        "",
        f"scanned: {report.scanned}",
        f"linked: {report.linked}",
        f"skipped_no_match: {report.skipped_no_match}",
        f"skipped_ambiguous: {report.skipped_ambiguous}",
        f"skipped_already_linked: {report.skipped_already_linked}",
        f"skipped_invalid: {report.skipped_invalid}",
        "",
    ]
    return "\n".join(lines)


def _normalize_email(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_workspace_id(value: Any) -> str:
    return str(value or "").strip()


async def run_conversation_customer_backfill(
    database: Any,
    *,
    dry_run: bool,
) -> ConversationCustomerBackfillReport:
    """Set customer_id on unlinked conversations with an exact workspace email match."""
    report = ConversationCustomerBackfillReport(dry_run=dry_run)
    conversations = database[CONVERSATIONS_COLLECTION]
    customers = database[CUSTOMERS_COLLECTION]

    cursor = conversations.find({})
    documents = await cursor.to_list(length=None)
    report.scanned = len(documents)

    for document in documents:
        conversation_id = str(document.get("_id") or "")
        existing_customer_id = str(document.get("customer_id") or "").strip()
        if existing_customer_id:
            report.skipped_already_linked += 1
            continue

        workspace_id = _normalize_workspace_id(document.get("workspace_id"))
        email = _normalize_email(document.get("customer_email"))
        if not conversation_id or not workspace_id or not email:
            report.skipped_invalid += 1
            continue

        matches = await customers.find(
            {"workspace_id": workspace_id, "email": email},
        ).to_list(length=2)
        if len(matches) == 0:
            report.skipped_no_match += 1
            continue
        if len(matches) != 1:
            report.skipped_ambiguous += 1
            continue

        customer_id = str(matches[0]["_id"])
        report.linked += 1
        report.linked_ids.append(conversation_id)
        if dry_run:
            continue
        await conversations.update_one(
            {
                "_id": document["_id"],
                "workspace_id": workspace_id,
                **unlinked_customer_id_filter(),
            },
            {"$set": {"customer_id": customer_id}},
        )

    return report
