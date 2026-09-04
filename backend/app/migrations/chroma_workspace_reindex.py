"""Phase 1D-4 Chroma workspace re-index.

Re-embeds published knowledge documents so Chroma chunk metadata includes
``workspace_id``. Does not drop the collection. Does not invent workspace
mappings for documents that still lack ``workspace_id``.

Not run on application startup.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.knowledge import KNOWLEDGE_DOCUMENTS_COLLECTION, utc_now
from app.services.knowledge_ingestion import ingest_knowledge_document

PUBLISHED_STATUS = "Published"


def published_with_workspace_filter() -> dict[str, Any]:
    """Published Mongo knowledge documents that already have a workspace_id."""
    return {
        "status": PUBLISHED_STATUS,
        "workspace_id": {"$exists": True, "$nin": [None, ""]},
    }


def published_missing_workspace_filter() -> dict[str, Any]:
    return {
        "status": PUBLISHED_STATUS,
        "$or": [
            {"workspace_id": {"$exists": False}},
            {"workspace_id": None},
            {"workspace_id": ""},
        ],
    }


@dataclass
class ChromaReindexReport:
    dry_run: bool
    planned: int = 0
    indexed: int = 0
    failed: int = 0
    skipped_missing_workspace: int = 0
    document_ids: list[str] = field(default_factory=list)
    failed_ids: list[str] = field(default_factory=list)

    def resource_counts(self) -> dict[str, int]:
        return {
            "planned": self.planned,
            "indexed": self.indexed,
            "failed": self.failed,
            "skipped_missing_workspace": self.skipped_missing_workspace,
        }


def format_chroma_reindex_report(report: ChromaReindexReport) -> str:
    mode = (
        "DRY RUN (zero Chroma writes)"
        if report.dry_run
        else "WRITE (re-index published knowledge into Chroma)"
    )
    lines = [
        "Phase 1D-4 Chroma workspace re-index",
        f"Mode: {mode}",
        "",
        f"planned: {report.planned}",
        f"indexed: {report.indexed}",
        f"failed: {report.failed}",
        f"skipped_missing_workspace: {report.skipped_missing_workspace}",
        "",
    ]
    if report.failed_ids:
        lines.append("Failed document ids:")
        for document_id in report.failed_ids:
            lines.append(f"  {document_id}")
        lines.append("")
    return "\n".join(lines)


async def _persist_ingestion(
    collection: Any,
    document_id: str,
    workspace_id: str,
    result: dict[str, Any],
) -> None:
    result.pop("_exception", None)
    await collection.update_one(
        {"_id": document_id, "workspace_id": workspace_id},
        {
            "$set": {
                "ingestion_status": result["ingestion_status"],
                "ingestion_error": result.get("ingestion_error"),
                "ingested_at": result.get("ingested_at"),
                "chunk_count": int(result.get("chunk_count") or 0),
                "updated_at": utc_now(),
            },
        },
    )


async def run_chroma_workspace_reindex(
    database: Any,
    *,
    dry_run: bool = False,
) -> ChromaReindexReport:
    """Re-index published knowledge documents that already have workspace_id."""
    collection = database[KNOWLEDGE_DOCUMENTS_COLLECTION]
    report = ChromaReindexReport(dry_run=dry_run)

    report.skipped_missing_workspace = await collection.count_documents(
        published_missing_workspace_filter(),
    )

    cursor = collection.find(published_with_workspace_filter())
    documents = await cursor.to_list(length=10000)
    report.planned = len(documents)
    report.document_ids = [str(doc["_id"]) for doc in documents]

    if dry_run:
        return report

    for document in documents:
        document_id = str(document["_id"])
        workspace_id = str(document["workspace_id"])
        result = await ingest_knowledge_document(document)
        await _persist_ingestion(collection, document_id, workspace_id, result)
        if result.get("ingestion_status") == "indexed":
            report.indexed += 1
        else:
            report.failed += 1
            report.failed_ids.append(document_id)

    return report
