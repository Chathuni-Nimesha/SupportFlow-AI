"""Phase 1I explicit owner_id index cleanup.

Drops obsolete unique ``(owner_id, email)`` indexes that incorrectly
constrain emails across workspaces. Does not delete documents. Does not
change ``workspace_id`` or ``owner_id`` fields. Does not run on startup.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.customer import CUSTOMERS_COLLECTION
from app.models.team_member import TEAM_MEMBERS_COLLECTION

# Proven obsolete unique indexes. Runtime uniqueness is (workspace_id, email).
OBSOLETE_UNIQUE_INDEXES: tuple[tuple[str, tuple[tuple[str, int], ...]], ...] = (
    (CUSTOMERS_COLLECTION, (("owner_id", 1), ("email", 1))),
    (TEAM_MEMBERS_COLLECTION, (("owner_id", 1), ("email", 1))),
)


@dataclass
class IndexCleanupItem:
    collection: str
    keys: tuple[tuple[str, int], ...]
    name: str | None
    action: str


@dataclass
class OwnerIdCleanupReport:
    dry_run: bool
    scanned: int = 0
    changed: int = 0
    skipped: int = 0
    indexes: list[IndexCleanupItem] = field(default_factory=list)

    def resource_counts(self) -> dict[str, int]:
        return {
            "scanned": self.scanned,
            "changed": self.changed,
            "skipped": self.skipped,
        }


def format_owner_id_cleanup_report(report: OwnerIdCleanupReport) -> str:
    mode = (
        "DRY RUN (zero index drops)"
        if report.dry_run
        else "WRITE (drop obsolete unique owner_id indexes)"
    )
    lines = [
        "Phase 1I owner_id index cleanup",
        f"Mode: {mode}",
        "",
        f"scanned: {report.scanned}",
        f"changed: {report.changed}",
        f"skipped: {report.skipped}",
        "",
    ]
    if report.indexes:
        lines.append("Indexes:")
        for item in report.indexes:
            key = ", ".join(f"{field}:{direction}" for field, direction in item.keys)
            name = item.name or "(missing)"
            lines.append(
                f"  {item.collection} ({key}) name={name} -> {item.action}",
            )
        lines.append("")
    return "\n".join(lines)


def _index_keys(spec: dict[str, Any]) -> list[tuple[Any, Any]]:
    return list(spec.get("key") or [])


def _matches_obsolete(spec: dict[str, Any], expected: tuple[tuple[str, int], ...]) -> bool:
    if not spec.get("unique"):
        return False
    return _index_keys(spec) == list(expected)


async def _matching_index_names(
    collection: Any,
    expected: tuple[tuple[str, int], ...],
) -> list[str]:
    info = await collection.index_information()
    return [
        name
        for name, spec in info.items()
        if _matches_obsolete(spec, expected)
    ]


async def run_owner_id_cleanup(
    database: Any,
    *,
    dry_run: bool,
) -> OwnerIdCleanupReport:
    """Drop obsolete unique owner_id email indexes. Never mutates documents."""
    report = OwnerIdCleanupReport(dry_run=dry_run)
    for collection_name, keys in OBSOLETE_UNIQUE_INDEXES:
        report.scanned += 1
        collection = database[collection_name]
        names = await _matching_index_names(collection, keys)
        if not names:
            report.skipped += 1
            report.indexes.append(
                IndexCleanupItem(
                    collection=collection_name,
                    keys=keys,
                    name=None,
                    action="skipped (not present)",
                ),
            )
            continue
        for name in names:
            if dry_run:
                report.changed += 1
                report.indexes.append(
                    IndexCleanupItem(
                        collection=collection_name,
                        keys=keys,
                        name=name,
                        action="would drop",
                    ),
                )
                continue
            await collection.drop_index(name)
            report.changed += 1
            report.indexes.append(
                IndexCleanupItem(
                    collection=collection_name,
                    keys=keys,
                    name=name,
                    action="dropped",
                ),
            )
    return report
