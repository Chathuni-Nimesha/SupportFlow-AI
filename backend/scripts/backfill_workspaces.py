"""CLI: additive personal-workspace backfill (Phase 1B).

Run from the repository root:

    python -m backend.scripts.backfill_workspaces --dry-run
    python -m backend.scripts.backfill_workspaces

From ``backend/``:

    python -m scripts.backfill_workspaces --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.database.mongodb import close_mongodb, connect_mongodb, get_database
from app.migrations.workspace_backfill import (
    format_backfill_report,
    run_workspace_backfill,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create one personal workspace per user and set workspace_id on "
            "owner-scoped documents that do not already have one. "
            "Does not change owner_id, assignees, Chroma, or runtime queries."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned counts without writing to MongoDB.",
    )
    return parser.parse_args(argv)


async def async_main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    await connect_mongodb()
    try:
        report = await run_workspace_backfill(
            get_database(),
            dry_run=args.dry_run,
        )
        print(format_backfill_report(report), end="")
    finally:
        await close_mongodb()
    return 0


def main(argv: list[str] | None = None) -> int:
    return asyncio.run(async_main(argv))


if __name__ == "__main__":
    raise SystemExit(main())
