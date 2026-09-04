"""CLI: drop obsolete unique owner_id indexes (Phase 1I).

Run from the repository root:

    python -m backend.scripts.cleanup_owner_id --dry-run
    python -m backend.scripts.cleanup_owner_id

From ``backend/``:

    python -m scripts.cleanup_owner_id --dry-run
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
from app.migrations.owner_id_cleanup import (
    format_owner_id_cleanup_report,
    run_owner_id_cleanup,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Drop obsolete unique (owner_id, email) indexes on customers and "
            "team_members. Does not delete documents. Does not change "
            "workspace_id or owner_id fields. Does not run on startup."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned index drops without changing MongoDB.",
    )
    return parser.parse_args(argv)


async def async_main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    await connect_mongodb()
    try:
        report = await run_owner_id_cleanup(
            get_database(),
            dry_run=args.dry_run,
        )
        print(format_owner_id_cleanup_report(report), end="")
    finally:
        await close_mongodb()
    return 0


def main(argv: list[str] | None = None) -> int:
    return asyncio.run(async_main(argv))


if __name__ == "__main__":
    raise SystemExit(main())
